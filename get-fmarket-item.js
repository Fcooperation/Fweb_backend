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
       GET REQUEST DATA
    ========================= */

    const {
      itemId,
      userId
    } =
      req.body || {};


    /* =========================
       CHECK ITEM ID
    ========================= */

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
       CHECK OWNERSHIP
    ========================= */

    let owned = false;


    if (
      userId
    ) {

      const {
        data: purchase,
        error: purchaseError
      } =
        await supabase
          .from(
            "fmarket_purchases"
          )
          .select(
            "id"
          )
          .eq(
            "buyer_id",
            userId
          )
          .eq(
            "material_id",
            itemId
          )
          .maybeSingle();


      if (
        purchaseError
      ) {

        return res.status(500).json({
          success: false,
          error:
            "Unable to check material ownership."
        });

      }


      owned =
        !!purchase;

    }


    /* =========================
       CHECK PRICE
    ========================= */

    const price =
      Number(data.price) || 0;


    /* =========================
       FREE MATERIAL
       
       RETURN EVERYTHING
       + OWNERSHIP
    ========================= */

    if (
      price === 0
    ) {

      return res.status(200).json({

        success: true,

        owned,

        material: {
          ...data,

          owned

        }

      });

    }


    /* =========================
       PAID MATERIAL
       
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

      owned,

      material: {

        ...material,

        owned

      }

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