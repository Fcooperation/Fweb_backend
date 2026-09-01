import "dotenv/config";

import {
  createClient
} from "@supabase/supabase-js";


/* =========================
   SUPABASE
========================= */

const supabase =
  createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );


/* =========================
   ALLOWED CATEGORIES
========================= */

const ALLOWED_CATEGORIES = [
  "notes",
  "past_questions",
  "textbook",
  "handout",
  "study_guide",
  "other"
];


/* =========================
   ALLOWED CONDITIONS
========================= */

const ALLOWED_CONDITIONS = [
  "new",
  "used",
  "digital",
  "na"
];


/* =========================
   SELL ITEM
========================= */

export default async function fmarketSell(
  req,
  res
) {

  try {

    const {
      userId,
      title,
      description,
      category,
      course,
      university,
      department,
      price,
      location,
      condition,
      image_url,
      file_url
    } = req.body;


    /* =========================
       USER ID
    ========================= */

    if (!userId) {

      return res.status(400).json({
        success: false,
        error:
          "User ID is required."
      });

    }


    /* =========================
       VERIFY USER
    ========================= */

    const {
      data: seller,
      error: sellerError
    } =
      await supabase
        .from("fwebaccount")
        .select("id, username")
        .eq(
          "id",
          userId
        )
        .maybeSingle();


    if (sellerError) {

      return res.status(500).json({
        success: false,
        error:
          "Could not verify seller account."
      });

    }


    if (!seller) {

      return res.status(404).json({
        success: false,
        error:
          "Seller account was not found."
      });

    }


    /* =========================
       TITLE
    ========================= */

    if (
      !title ||
      !String(title).trim()
    ) {

      return res.status(400).json({
        success: false,
        error:
          "Material title is required."
      });

    }


    const cleanTitle =
      String(title)
        .trim()
        .slice(0, 120);


    /* =========================
       CATEGORY
    ========================= */

    if (
      !category ||
      !ALLOWED_CATEGORIES.includes(
        category
      )
    ) {

      return res.status(400).json({
        success: false,
        error:
          "Invalid material category."
      });

    }


    /* =========================
       DESCRIPTION
    ========================= */

    const cleanDescription =
      description
        ? String(description)
            .trim()
            .slice(0, 2000)
        : null;


    /* =========================
       PRICE
    ========================= */

    const itemPrice =
      Number(price);


    if (
      !Number.isFinite(
        itemPrice
      )
    ) {

      return res.status(400).json({
        success: false,
        error:
          "Invalid FCoins price."
      });

    }


    const cleanPrice =
      Math.floor(
        itemPrice
      );


    if (
      cleanPrice < 0
    ) {

      return res.status(400).json({
        success: false,
        error:
          "Price cannot be negative."
      });

    }


    /* =========================
       CONDITION
    ========================= */

    if (
      condition &&
      !ALLOWED_CONDITIONS.includes(
        condition
      )
    ) {

      return res.status(400).json({
        success: false,
        error:
          "Invalid material condition."
      });

    }


    /* =========================
       CLEAN OPTIONAL DATA
    ========================= */

    const cleanCourse =
      course
        ? String(course)
            .trim()
            .slice(0, 100)
        : null;


    const cleanUniversity =
      university
        ? String(university)
            .trim()
            .slice(0, 150)
        : null;


    const cleanDepartment =
      department
        ? String(department)
            .trim()
            .slice(0, 150)
        : null;


    const cleanLocation =
      location
        ? String(location)
            .trim()
            .slice(0, 200)
        : null;


    const cleanImageUrl =
      image_url
        ? String(image_url)
            .trim()
            .slice(0, 2000)
        : null;


    const cleanFileUrl =
      file_url
        ? String(file_url)
            .trim()
            .slice(0, 2000)
        : null;


    /* =========================
       INSERT INTO FMARKET
    ========================= */

    const {
      data: item,
      error: insertError
    } =
      await supabase
        .from("fmarket")
        .insert({

          seller_id:
            seller.id,

          title:
            cleanTitle,

          description:
            cleanDescription,

          category:
            category,

          course:
            cleanCourse,

          university:
            cleanUniversity,

          department:
            cleanDepartment,

          price:
            cleanPrice,

          location:
            cleanLocation,

          image_url:
            cleanImageUrl,

          file_url:
            cleanFileUrl,

          condition:
            condition || null,

          status:
            "available",

          views:
            0

        })
        .select(
          `
            id,
            seller_id,
            title,
            description,
            category,
            course,
            university,
            department,
            price,
            location,
            image_url,
            file_url,
            condition,
            status,
            views,
            created_at,
            updated_at
          `
        )
        .single();


    /* =========================
       INSERT ERROR
    ========================= */

    if (insertError) {

      return res.status(500).json({
        success: false,
        error:
          "Could not create FMarket listing."
      });

    }


    /* =========================
       SUCCESS
    ========================= */

    return res.status(201).json({

      success: true,

      message:
        "Item listed successfully.",

      item: {

        ...item,

        seller_username:
          seller.username || null

      }

    });


  } catch (error) {

    return res.status(500).json({

      success: false,

      error:
        error.message ||
        "Unable to list FMarket item."

    });

  }

}