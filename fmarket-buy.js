import "dotenv/config";
import { createClient } from "@supabase/supabase-js";


/* =========================
   SUPABASE
========================= */

const supabase =
  createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );


/* =========================
   FMARKET BUY
========================= */

export async function fmarketBuy(
  req,
  res
) {

  try {

    /* =========================
       GET BODY
    ========================= */

    const {
      userId,
      materialId
    } =
      req.body || {};


    /* =========================
       VALIDATION
    ========================= */

    if (!userId) {

      return res.status(400).json({

        success: false,

        error:
          "User ID is required."

      });

    }


    if (!materialId) {

      return res.status(400).json({

        success: false,

        error:
          "Material ID is required."

      });

    }


    /* =========================
       BUY MATERIAL
       ATOMIC RPC
    ========================= */

    const {
      data,
      error
    } =
      await supabase.rpc(
        "buy_fmarket_material",
        {
          p_buyer_id:
            userId,

          p_material_id:
            materialId
        }
      );


    /* =========================
       RPC ERROR
    ========================= */

    if (error) {

      throw error;

    }


    /* =========================
       RETURN RESULT
    ========================= */

    return res.json(
      data
    );


  } catch (error) {

    console.error(
      "❌ FMarket buy error:",
      error.message
    );


    return res.status(500).json({

      success: false,

      error:
        error.message ||
        "Unable to complete purchase."

    });

  }

}