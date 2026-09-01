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


const PAYSTACK_SECRET_KEY =
  process.env.PAYSTACK_SECRET_KEY;


const MIN_NAIRA = 150;
const MAX_NAIRA = 150000;

const FEE_RATE = 0.05;

const FCOINS_PER_NAIRA =
  1000 / 1500;


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
        error: "Invalid top-up amount."
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
       
       Example:
       ₦1,500
       - 5% = ₦75
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
    } =
      await supabase
        .from(
          "fmarket_transactions"
        )
        .insert({

          user_id: userId,

          reference,

          type: "topup",

          amount_naira: naira,

          fcoins,

          status: "pending",

          payment_provider:
            "paystack",

          currency: "NGN"

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
       INITIALIZE PAYSTACK
    ========================= */

    const paystackResponse =
      await fetch(
        "https://api.paystack.co/transaction/initialize",
        {

          method: "POST",

          headers: {

            Authorization:
              `Bearer ${PAYSTACK_SECRET_KEY}`,

            "Content-Type":
              "application/json"

          },

          body: JSON.stringify({

            email,

            /*
             * Paystack expects Kobo.
             *
             * ₦1,500 = 150000 kobo
             */

            amount:
              naira * 100,

            currency:
              "NGN",

            reference,

            metadata: {

              user_id:
                userId,

              fmarket_transaction_id:
                transaction.id,

              amount_naira:
                naira,

              fcoins,

              fmarket_fee:
                feeNaira

            }

          })

        }
      );


    const paystackData =
      await paystackResponse.json();


    /* =========================
       PAYSTACK ERROR
    ========================= */

    if (
      !paystackResponse.ok ||
      !paystackData.status
    ) {

      await supabase
        .from(
          "fmarket_transactions"
        )
        .update({
          status: "failed"
        })
        .eq(
          "id",
          transaction.id
        );


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

      authorization_url:
        paystackData.data
          .authorization_url,

      access_code:
        paystackData.data
          .access_code,

      reference:
        paystackData.data
          .reference,

      amount_naira:
        naira,

      fcoins,

      fmarket_fee:
        feeNaira

    });


  } catch (error) {

    return res.status(500).json({

      success: false,

      error:
        error.message ||
        "Unable to initialize top-up."

    });

  }

}