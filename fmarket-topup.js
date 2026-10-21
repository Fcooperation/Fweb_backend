import "dotenv/config";

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

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
   SETTINGS
========================= */

const MIN_NAIRA = 150;
const MAX_NAIRA = 150000;

const FEE_RATE = 0.05;

const FCOINS_PER_NAIRA = 1000 / 1500;

/* =========================
   POST /fmarket-topup
========================= */

export default async function fmarketTopup(req, res) {
  try {
    const { userId, email, amount } = req.body;

    /* =========================
       VALIDATION
    ========================= */

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required."
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required."
      });
    }

    if (
      typeof amount !== "number" &&
      typeof amount !== "string"
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid top-up amount."
      });
    }

    const naira = Number(amount);

    if (
      !Number.isSafeInteger(naira) ||
      naira < MIN_NAIRA ||
      naira > MAX_NAIRA
    ) {
      return res.status(400).json({
        success: false,
        error: `Top-up must be between ₦${MIN_NAIRA} and ₦${MAX_NAIRA}, using whole naira amounts.`
      });
    }

    if (!PAYSTACK_SECRET_KEY) {
      throw new Error(
        "Paystack secret key is not configured."
      );
    }

    /* =========================
       CALCULATE FCOINS

       Example:
       ₦1,500 - 5% fee = ₦1,425
       ₦1,425 = 950 FCoins
    ========================= */

    const feeNaira = Math.floor(
      naira * FEE_RATE
    );

    const netNaira = naira - feeNaira;

    const fcoins = Math.floor(
      netNaira * FCOINS_PER_NAIRA
    );

    if (fcoins <= 0) {
      return res.status(400).json({
        success: false,
        error: "Top-up amount is too small."
      });
    }

    /* =========================
       GENERATE REFERENCE
    ========================= */

    const reference =
      `FM_${Date.now()}_${crypto
        .randomBytes(6)
        .toString("hex")}`;

    /* =========================
       CREATE PENDING TRANSACTION
    ========================= */

    const {
      data: transaction,
      error: transactionError
    } = await supabase
      .from("fmarket_transactions")
      .insert({
        user_id: userId,
        reference,
        type: "topup",
        amount_naira: naira,
        fcoins,
        status: "pending",
        payment_provider: "paystack",
        currency: "NGN"
      })
      .select()
      .single();

    if (transactionError) {
      console.error(
        "FMarket transaction creation failed:",
        transactionError.message
      );

      return res.status(500).json({
        success: false,
        error: "Could not create payment transaction."
      });
    }

    /* =========================
       INITIALIZE PAYSTACK
    ========================= */

    let paystackResponse;

    try {
      paystackResponse = await fetch(
        `${PAYSTACK_BASE_URL}/transaction/initialize`,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${PAYSTACK_SECRET_KEY}`,

            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            email,

            // Paystack expects the amount in kobo.
            amount: naira * 100,

            currency: "NGN",

            reference,

            callback_url:
              "https://fcooperation.vercel.app/fmarket-topup-callback",

            metadata: {
              fmarket_transaction_id:
                transaction.id,

              fmarket_reference:
                reference,

              amount_naira:
                naira,

              fcoins,

              fmarket_fee:
                feeNaira
            }
          })
        }
      );
    } catch {
      // Keep the transaction pending if the network
      // fails; the request may have reached Paystack.
      return res.status(502).json({
        success: false,
        error:
          "Could not contact Paystack. Check the transaction before retrying."
      });
    }

    const paystackData =
      await paystackResponse.json();

    if (
      !paystackResponse.ok ||
      !paystackData.status ||
      !paystackData.data?.authorization_url
    ) {
      console.error(
        "Paystack initialization failed:",
        paystackData
      );

      await supabase
        .from("fmarket_transactions")
        .update({
          status: "failed"
        })
        .eq("id", transaction.id)
        .eq("status", "pending");

      return res.status(502).json({
        success: false,
        error:
          paystackData.message ||
          "Paystack could not initialize the payment."
      });
    }

    /* =========================
       RETURN CHECKOUT URL
    ========================= */

    return res.json({
      success: true,

      checkout_url:
        paystackData.data.authorization_url,

      payment_reference:
        reference,

      amount_naira:
        naira,

      fcoins,

      fmarket_fee:
        feeNaira
    });

  } catch (error) {
    console.error(
      "FMarket top-up error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      error:
        "Unable to initialize FMarket top-up."
    });
  }
}
