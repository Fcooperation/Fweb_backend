import "dotenv/config";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/* =========================
   PAYSTACK
========================= */

const PAYSTACK_SECRET_KEY =
  process.env.PAYSTACK_SECRET_KEY;

const PAYSTACK_BASE_URL =
  process.env.PAYSTACK_BASE_URL ||
  "https://api.paystack.co";

/* =========================
   POST /fmarket-topup/verify
========================= */

export default async function fmarketTopupVerify(
  req,
  res
) {
  try {
    const {
      paymentReference
    } = req.body;

    /* =========================
       VALIDATION
    ========================= */

    if (
      typeof paymentReference !== "string" ||
      !/^FM_[A-Za-z0-9_]+$/.test(paymentReference)
    ) {
      return res.status(400).json({
        success: false,
        error: "A valid payment reference is required."
      });
    }

    if (!PAYSTACK_SECRET_KEY) {
      throw new Error(
        "Paystack secret key is not configured."
      );
    }

    /* =========================
       FIND OUR TRANSACTION
    ========================= */

    const {
      data: transaction,
      error: transactionError
    } = await supabase
      .from("fmarket_transactions")
      .select(`
        id,
        user_id,
        reference,
        amount_naira,
        fcoins,
        status,
        payment_provider,
        provider_transaction_id
      `)
      .eq("reference", paymentReference)
      .maybeSingle();

    if (transactionError) {
      console.error(
        "Transaction lookup failed:",
        transactionError.message
      );

      return res.status(500).json({
        success: false,
        error: "Could not find payment transaction."
      });
    }

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: "Payment transaction was not found."
      });
    }

    /* =========================
       CHECK PAYMENT PROVIDER
    ========================= */

    if (
      transaction.payment_provider !== "paystack"
    ) {
      return res.status(400).json({
        success: false,
        error: "This transaction does not use Paystack."
      });
    }

    /* =========================
       ALREADY SUCCESSFUL
    ========================= */

    if (transaction.status === "successful") {
      const {
        data: account,
        error: accountError
      } = await supabase
        .from("fwebaccount")
        .select("fcoins")
        .eq("id", transaction.user_id)
        .single();

      if (accountError || !account) {
        return res.status(500).json({
          success: false,
          error: "Could not retrieve account balance."
        });
      }

      return res.json({
        success: true,
        status: "successful",
        amount_naira: transaction.amount_naira,
        fcoins: transaction.fcoins,
        fcoins_balance: Number(account.fcoins || 0),
        payment_reference: transaction.reference,
        message: "Payment has already been processed."
      });
    }

    /* =========================
       VERIFY WITH PAYSTACK
    ========================= */

    const verifyResponse = await fetch(
      `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(
        transaction.reference
      )}`,
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${PAYSTACK_SECRET_KEY}`,

          Accept: "application/json"
        }
      }
    );

    const verifyData = await verifyResponse.json();

    if (
      !verifyResponse.ok ||
      !verifyData.status ||
      !verifyData.data
    ) {
      console.error(
        "Paystack verification failed:",
        verifyData.message
      );

      return res.status(502).json({
        success: false,
        error:
          verifyData.message ||
          "Unable to verify payment with Paystack."
      });
    }

    const payment = verifyData.data;

    /* =========================
       CHECK REFERENCE
    ========================= */

    if (
      payment.reference !== transaction.reference
    ) {
      return res.status(400).json({
        success: false,
        error: "Payment reference does not match."
      });
    }

    /* =========================
       CHECK CURRENCY
    ========================= */

    if (payment.currency !== "NGN") {
      return res.status(400).json({
        success: false,
        error: "Payment currency does not match NGN."
      });
    }

    /* =========================
       CHECK AMOUNT
       PAYSTACK RETURNS KOBO
    ========================= */

    const expectedKobo =
      Number(transaction.amount_naira) * 100;

    const paidKobo =
      Number(payment.amount);

    if (
      !Number.isSafeInteger(expectedKobo) ||
      !Number.isSafeInteger(paidKobo) ||
      paidKobo !== expectedKobo
    ) {
      return res.status(400).json({
        success: false,
        error:
          "The verified payment amount does not match the expected amount."
      });
    }

    /* =========================
       CHECK PAYMENT STATUS
    ========================= */

    if (payment.status !== "success") {
      return res.json({
        success: true,
        status: "pending",
        payment_status: payment.status,
        amount_naira: transaction.amount_naira,
        fcoins: transaction.fcoins,
        message:
          `Payment has not succeeded. Current status: ${payment.status}.`
      });
    }

    /* =========================
       ATOMIC FCOIN CREDIT
    ========================= */

    /*
     * This RPC must atomically:
     * 1. Lock/check the transaction.
     * 2. Confirm it is still pending.
     * 3. Credit FCoins exactly once.
     * 4. Save the Paystack transaction ID.
     * 5. Mark the transaction successful.
     *
     * Create the SQL function below before
     * deploying this endpoint.
     */

    const {
      data: result,
      error: creditError
    } = await supabase.rpc(
      "fmarket_complete_topup",
      {
        p_transaction_id: transaction.id,
        p_provider_transaction_id: String(
          payment.id
        ),
        p_paid_at:
          payment.paid_at ||
          new Date().toISOString()
      }
    );

    if (creditError) {
      console.error(
        "Atomic FCoins credit failed:",
        creditError.message
      );

      return res.status(500).json({
        success: false,
        error:
          "Payment was verified, but FCoins processing could not be completed. Please retry verification."
      });
    }

    const outcome = Array.isArray(result)
      ? result[0]
      : result;

    if (
      !outcome ||
      outcome.success !== true
    ) {
      return res.status(409).json({
        success: false,
        error:
          outcome?.message ||
          "The transaction could not be completed."
      });
    }

    /* =========================
       SUCCESS
    ========================= */

    return res.json({
      success: true,
      status: "successful",
      amount_naira: transaction.amount_naira,
      fcoins: transaction.fcoins,
      fcoins_balance: Number(
        outcome.fcoins_balance
      ),
      payment_reference: transaction.reference,
      transaction_reference: String(payment.id),
      message:
        "Payment verified and FCoins added successfully."
    });

  } catch (error) {
    console.error(
      "FMarket verification error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      error: "Unable to verify FMarket payment."
    });
  }
        }
