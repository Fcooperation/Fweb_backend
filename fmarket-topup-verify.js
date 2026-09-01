import "dotenv/config";

import {
  createClient
} from "@supabase/supabase-js";


const supabase =
  createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );


/* =========================
   MONNIFY
========================= */

const MONNIFY_API_KEY =
  process.env.MONNIFY_API_KEY;

const MONNIFY_SECRET_KEY =
  process.env.MONNIFY_SECRET_KEY;

const MONNIFY_BASE_URL =
  process.env.MONNIFY_BASE_URL ||
  "https://sandbox.monnify.com";


/* =========================
   GET MONNIFY ACCESS TOKEN
========================= */

async function getMonnifyAccessToken() {

  const credentials =
    Buffer
      .from(
        `${MONNIFY_API_KEY}:${MONNIFY_SECRET_KEY}`
      )
      .toString("base64");


  const response =
    await fetch(
      `${MONNIFY_BASE_URL}/api/v1/auth/login`,
      {
        method: "POST",

        headers: {
          Authorization:
            `Basic ${credentials}`,

          "Content-Type":
            "application/json"
        }
      }
    );


  const data =
    await response.json();


  if (
    !response.ok ||
    !data.requestSuccessful ||
    !data.responseBody?.accessToken
  ) {

    throw new Error(
      data.responseMessage ||
      "Unable to authenticate with Monnify."
    );

  }


  return data.responseBody.accessToken;

}


/* =========================
   POST /fmarket-topup/verify
========================= */

export default async function fmarketTopupVerify(
  req,
  res
) {

  try {

    const {
      paymentReference,
      transactionReference
    } = req.body;


    /* =========================
       VALIDATION
    ========================= */

    if (
      !paymentReference &&
      !transactionReference
    ) {

      return res.status(400).json({

        success:
          false,

        error:
          "Payment reference is required."

      });

    }


    /* =========================
       FIND OUR TRANSACTION
    ========================= */

    let query =
      supabase
        .from(
          "fmarket_transactions"
        )
        .select(
          `
            id,
            user_id,
            reference,
            amount_naira,
            fcoins,
            status,
            payment_provider,
            provider_transaction_id
          `
        );


    if (
      paymentReference
    ) {

      query =
        query.eq(
          "reference",
          paymentReference
        );

    } else {

      query =
        query.eq(
          "provider_transaction_id",
          transactionReference
        );

    }


    const {
      data: transaction,
      error: transactionError
    } =
      await query
        .maybeSingle();


    if (
      transactionError
    ) {

      return res.status(500).json({

        success:
          false,

        error:
          "Could not find payment transaction."

      });

    }


    if (
      !transaction
    ) {

      return res.status(404).json({

        success:
          false,

        error:
          "Payment transaction was not found."

      });

    }


    /* =========================
       ALREADY SUCCESSFUL
    ========================= */

    if (
      transaction.status ===
      "successful"
    ) {

      const {
        data: account
      } =
        await supabase
          .from(
            "fwebaccount"
          )
          .select(
            "fcoins"
          )
          .eq(
            "id",
            transaction.user_id
          )
          .single();


      return res.json({

        success:
          true,

        status:
          "successful",

        amount_naira:
          transaction.amount_naira,

        fcoins:
          transaction.fcoins,

        fcoins_balance:
          Number(
            account?.fcoins || 0
          ),

        message:
          "Payment has already been processed."

      });

    }


    /* =========================
       GET MONNIFY TOKEN
    ========================= */

    const accessToken =
      await getMonnifyAccessToken();


    /* =========================
       VERIFY WITH MONNIFY
    ========================= */

    let verifyUrl;


    if (
      paymentReference
    ) {

      verifyUrl =
        `${MONNIFY_BASE_URL}` +
        `/api/v2/merchant/transactions/query` +
        `?paymentReference=${encodeURIComponent(
          paymentReference
        )}`;

    } else {

      verifyUrl =
        `${MONNIFY_BASE_URL}` +
        `/api/v2/merchant/transactions/query` +
        `?transactionReference=${encodeURIComponent(
          transactionReference
        )}`;

    }


    const monnifyResponse =
      await fetch(
        verifyUrl,
        {
          method:
            "GET",

          headers: {
            Authorization:
              `Bearer ${accessToken}`
          }
        }
      );


    const monnifyData =
      await monnifyResponse.json();


    if (
      !monnifyResponse.ok ||
      !monnifyData.requestSuccessful ||
      !monnifyData.responseBody
    ) {

      return res.status(502).json({

        success:
          false,

        error:
          monnifyData.responseMessage ||
          "Unable to verify payment with Monnify."

      });

    }


    const payment =
      monnifyData.responseBody;


    /* =========================
       CHECK REFERENCES
    ========================= */

    if (
      payment.paymentReference !==
      transaction.reference
    ) {

      return res.status(400).json({

        success:
          false,

        error:
          "Payment reference does not match."

      });

    }


    /* =========================
       CHECK AMOUNT
    ========================= */

    const expectedAmount =
      Number(
        transaction.amount_naira
      );

    const paidAmount =
      Number(
        payment.amountPaid
      );


    if (
      !Number.isFinite(
        paidAmount
      ) ||
      paidAmount <
      expectedAmount
    ) {

      return res.status(400).json({

        success:
          false,

        status:
          payment.paymentStatus,

        error:
          "The payment amount does not match the expected amount."

      });

    }


    /* =========================
       CHECK PAYMENT STATUS
    ========================= */

    if (
      payment.paymentStatus !==
      "PAID"
    ) {

      return res.json({

        success:
          true,

        status:
          "pending",

        payment_status:
          payment.paymentStatus,

        amount_naira:
          transaction.amount_naira,

        fcoins:
          transaction.fcoins,

        message:
          `Payment status: ${payment.paymentStatus}.`

      });

    }


    /* =========================
       CREDIT FCOINS
    ========================= */

    /*
     * IMPORTANT:
     *
     * We only get here after
     * Monnify confirms PAID and
     * the amount matches.
     */


    const {
      data: account,
      error: accountError
    } =
      await supabase
        .from(
          "fwebaccount"
        )
        .select(
          "fcoins"
        )
        .eq(
          "id",
          transaction.user_id
        )
        .single();


    if (
      accountError ||
      !account
    ) {

      return res.status(500).json({

        success:
          false,

        error:
          "User account could not be found."

      });

    }


    const currentFcoins =
      Number(
        account.fcoins || 0
      );


    const newFcoins =
      currentFcoins +
      Number(
        transaction.fcoins
      );


    /* =========================
       UPDATE ACCOUNT
    ========================= */

    const {
      error: updateAccountError
    } =
      await supabase
        .from(
          "fwebaccount"
        )
        .update({

          fcoins:
            newFcoins

        })
        .eq(
          "id",
          transaction.user_id
        );


    if (
      updateAccountError
    ) {

      return res.status(500).json({

        success:
          false,

        error:
          "Payment was verified, but FCoins could not be added."

      });

    }


    /* =========================
       MARK TRANSACTION SUCCESSFUL
    ========================= */

    const {
      error: updateTransactionError
    } =
      await supabase
        .from(
          "fmarket_transactions"
        )
        .update({

          status:
            "successful",

          provider_transaction_id:
            payment.transactionReference,

          paid_at:
            payment.paidOn ||
            new Date().toISOString(),

          updated_at:
            new Date().toISOString()

        })
        .eq(
          "id",
          transaction.id
        );


    if (
      updateTransactionError
    ) {

      /*
       * The account was already credited.
       *
       * Do NOT try to credit again.
       *
       * Return the current successful
       * result so the frontend can finish.
       */

      return res.json({

        success:
          true,

        status:
          "successful",

        amount_naira:
          transaction.amount_naira,

        fcoins:
          transaction.fcoins,

        fcoins_balance:
          newFcoins,

        message:
          "Payment verified successfully."

      });

    }


    /* =========================
       SUCCESS
    ========================= */

    return res.json({

      success:
        true,

      status:
        "successful",

      amount_naira:
        transaction.amount_naira,

      fcoins:
        transaction.fcoins,

      fcoins_balance:
        newFcoins,

      payment_reference:
        transaction.reference,

      transaction_reference:
        payment.transactionReference,

      message:
        "Payment verified and FCoins added successfully."

    });


  } catch (error) {

    return res.status(500).json({

      success:
        false,

      error:
        error.message ||
        "Unable to verify FMarket payment."

    });

  }

}