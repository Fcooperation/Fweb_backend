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
   GET FMARKET ITEM
========================= */

export async function getFMarketItem(
  req,
  res
) {

  try {

    /* =========================
       ONLY POST
    ========================= */

    if (
      req.method !== "POST"
    ) {

      return res.status(405).json({
        success: false,
        error: "Method not allowed."
      });

    }


    /* =========================
       GET ITEM ID
    ========================= */

    const {
      itemId
    } =
      req.body || {};


    if (
      !itemId ||
      typeof itemId !== "string"
    ) {

      return res.status(400).json({
        success: false,
        error: "Item ID is required."
      });

    }


    /* =========================
       GET ITEM
    ========================= */

    const {
      data,
      error
    } =
      await supabase
        .from("fmarket")
        .select("*")
        .eq(
          "id",
          itemId
        )
        .maybeSingle();


    /* =========================
       DATABASE ERROR
    ========================= */

    if (error) {

      return res.status(500).json({
        success: false,
        error:
          "Unable to retrieve market item."
      });

    }


    /* =========================
       NOT FOUND
    ========================= */

    if (!data) {

      return res.status(404).json({
        success: false,
        error:
          "This market item no longer exists."
      });

    }


    /* =========================
       REMOVE NOTE DATA
    ========================= */

    const {
      note_data,
      ...material
    } = data;


    /* =========================
       SUCCESS
    ========================= */

    return res.status(200).json({

      success: true,

      material

    });

  } catch (error) {

    return res.status(500).json({

      success: false,

      error:
        error.message ||
        "Unable to retrieve market item."

    });

  }

}