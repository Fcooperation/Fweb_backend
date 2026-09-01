import "dotenv/config";

import {
  createClient
} from "@supabase/supabase-js";

import crypto from "crypto";


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

const MONNIFY_CONTRACT_CODE =
  process.env.MONNIFY_CONTRACT_CODE;

const MONNIFY_BASE_URL =
  process.env.MONNIFY_BASE_URL ||
  "https://sandbox.monnify.com";


/* =========================
   SETTINGS
========================= */

const MIN_NAIRA = 150;

const MAX_NAIRA = 150000;

const FEE_RATE = 0.05;

const FCOINS_PER_NAIRA =
  1000 / 1500;


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
   POST /fmarket-topup
========================= */

export default async function fmarketTopup(
  req,
  res
) {

  try {

    const {
      userId,
      email,
      amount
    } = req.body;


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


    const naira =
      Math.floor(
        Number(amount)
      );


    if (
      !Number.isFinite(naira)
    ) {

      return res.status(400).json({
        success: false,
        error:
          "Invalid top-up amount."
      });

    }


    if (
      naira < MIN_NAIRA
    ) {

      return res.status(400).json({
        success: false,
        error:
          `Minimum top-up is ₦${MIN_NAIRA}.`
      });

    }


    if (
      naira > MAX_NAIRA
    ) {

      return res.status(400).json({
        success: false,
        error:
          `Maximum top-up is ₦${MAX_NAIRA}.`
      });

    }


    /* =========================
       CALCULATE FCOINS
       
       ₦1,500
       - 5% FMarket fee = ₦75
       = ₦1,425

       ₦1,425 × 1000 / 1500
       = 950 FCoins
    ========================= */

    const feeNaira =
      Math.floor(
        naira * FEE_RATE
      );


    const netNaira =
      naira - feeNaira;


    const fcoins =
      Math.floor(
        netNaira *
        FCOINS_PER_NAIRA
      );


    if (
      fcoins <= 0
    ) {

      return res.status(400).json({
        success: false,
        error:
          "Top-up amount is too small."
      });

    }


    /* =========================
       GENERATE PAYMENT REFERENCE
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
    } =
      await supabase
        .from(
          "fmarket_transactions"
        )
        .insert({

          user_id:
            userId,

          reference:
            reference,

          type:
            "topup",

          amount_naira:
            naira,

          fcoins:
            fcoins,

          status:
            "pending",

          payment_provider:
            "monnify",

          currency:
            "NGN"

        })
        .select()
        .single();


    if (
      transactionError
    ) {

      return res.status(500).json({
        success: false,
        error:
          "Could not create payment transaction."
      });

    }


    /* =========================
       GET MONNIFY TOKEN
    ========================= */

    const accessToken =
      await getMonnifyAccessToken();


    /* =========================
       INITIALIZE MONNIFY
    ========================= */

    const monnifyResponse =
      await fetch(
        `${MONNIFY_BASE_URL}/api/v1/merchant/transactions/init-transaction`,
        {

          method: "POST",

          headers: {

            Authorization:
              `Bearer ${accessToken}`,

            "Content-Type":
              "application/json"

          },

          body: JSON.stringify({

            amount:
              naira,

            customerEmail:
              email,

            paymentReference:
              reference,

            paymentDescription:
              "FMarket FCoins Top Up",

            currencyCode:
              "NGN",

            contractCode:
              MONNIFY_CONTRACT_CODE,

            /*
             * Change this to your actual
             * frontend callback URL.
             *
             * Example:
             * https://fweb.com/fmarket-topup-callback
             */

            redirectUrl:
              "https://fcooperation.vercel.app/fmarket-topup-callback",

            paymentMethods: [
              "CARD",
              "ACCOUNT_TRANSFER",
              "USSD",
              "PHONE_NUMBER"
            ],

            metadata: {

              user_id:
                userId,

              fmarket_transaction_id:
                transaction.id,

              amount_naira:
                naira,

              fcoins:
                fcoins,

              fmarket_fee:
                feeNaira

            }

          })

        }
      );


    const monnifyData =
      await monnifyResponse.json();


    /* =========================
       MONNIFY ERROR
    ========================= */

    if (
      !monnifyResponse.ok ||
      !monnifyData.requestSuccessful ||
      !monnifyData.responseBody?.checkoutUrl
    ) {

      await supabase
        .from(
          "fmarket_transactions"
        )
        .update({
          status:
            "failed"
        })
        .eq(
          "id",
          transaction.id
        );


      return res.status(502).json({

        success:
          false,

        error:
          monnifyData.responseMessage ||
          "Monnify could not initialize the payment."

      });

    }


    /* =========================
       RETURN CHECKOUT URL
    ========================= */

    return res.json({

      success:
        true,

      checkout_url:
        monnifyData.responseBody
          .checkoutUrl,

      payment_reference:
        monnifyData.responseBody
          .paymentReference,

      transaction_reference:
        monnifyData.responseBody
          .transactionReference,

      amount_naira:
        naira,

      fcoins:
        fcoins,

      fmarket_fee:
        feeNaira

    });


  } catch (error) {

    return res.status(500).json({

      success:
        false,

      error:
        error.message ||
        "Unable to initialize FMarket top-up."

    });

  }

}