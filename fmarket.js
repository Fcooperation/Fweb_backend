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
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );


/* =========================
   SETTINGS
========================= */

const MATERIALS_PER_PAGE = 10;


/* =========================
   FMARKET
========================= */

export default async function fmarket(
  req,
  res
) {

  try {

    /* =========================
       REQUEST PARAMETERS
    ========================= */

    const userId =
      req.query.userId || null;


    let page =
      parseInt(
        req.query.page,
        10
      ) || 1;


    if (page < 1) {
      page = 1;
    }


    const category =
      req.query.category ||
      null;


    const course =
      req.query.course ||
      null;


    const university =
      req.query.university ||
      null;


    const search =
      req.query.search?.trim() ||
      null;


    /* =========================
       PAGINATION
    ========================= */

    const from =
      (page - 1) *
      MATERIALS_PER_PAGE;


    const to =
      from +
      MATERIALS_PER_PAGE -
      1;


    /* =========================
       GET MATERIALS
    ========================= */

    let query =
      supabase
        .from("fmarket")
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
          `,
          {
            count: "exact"
          }
        )
        .eq(
          "status",
          "available"
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        )
        .range(
          from,
          to
        );


    /* =========================
       FILTER: CATEGORY
    ========================= */

    if (category) {

      query =
        query.eq(
          "category",
          category
        );

    }


    /* =========================
       FILTER: COURSE
    ========================= */

    if (course) {

      query =
        query.ilike(
          "course",
          course
        );

    }


    /* =========================
       FILTER: UNIVERSITY
    ========================= */

    if (university) {

      query =
        query.ilike(
          "university",
          university
        );

    }


    /* =========================
       SEARCH
    ========================= */

    if (search) {

      query =
        query.or(
          `title.ilike.%${search}%,description.ilike.%${search}%,course.ilike.%${search}%,category.ilike.%${search}%`
        );

    }


    const {
      data: materials,
      error: materialsError,
      count
    } =
      await query;


    if (materialsError) {

      throw materialsError;

    }


    /* =========================
       GET SELLER IDs
    ========================= */

    const sellerIds =
      [
        ...new Set(
          (materials || [])
            .map(
              material =>
                material.seller_id
            )
            .filter(Boolean)
        )
      ];


    /* =========================
       GET SELLERS
    ========================= */

    let sellers = [];


    if (
      sellerIds.length
    ) {

      const {
        data,
        error
      } =
        await supabase
          .from("fwebaccount")
          .select(
            "id, username"
          )
          .in(
            "id",
            sellerIds
          );


      if (error) {

        throw error;

      }


      sellers =
        data || [];

    }


    /* =========================
       CREATE SELLER MAP
    ========================= */

    const sellerMap =
      new Map();


    sellers.forEach(
      seller => {

        sellerMap.set(
          seller.id,
          seller
        );

      }
    );


    /* =========================
       ADD SELLER INFORMATION
    ========================= */

    const formattedMaterials =
      (materials || [])
        .map(
          material => {

            const seller =
              sellerMap.get(
                material.seller_id
              );


            return {

              id:
                material.id,

              seller_id:
                material.seller_id,

              seller_name:
                seller?.username ||
                "Unknown seller",

              title:
                material.title,

              description:
                material.description,

              category:
                material.category,

              course:
                material.course,

              university:
                material.university,

              department:
                material.department,

              price:
                material.price,

              location:
                material.location,

              image_url:
                material.image_url,

              file_url:
                material.file_url,

              condition:
                material.condition,

              status:
                material.status,

              views:
                material.views,

              created_at:
                material.created_at,

              updated_at:
                material.updated_at

            };

          }
        );


    /* =========================
       TOTAL PAGES
    ========================= */

    const totalMaterials =
      count || 0;


    const totalPages =
      Math.ceil(
        totalMaterials /
        MATERIALS_PER_PAGE
      );


    /* =========================
       USER FCOINS
    ========================= */

    let fcoins = 0;


    if (userId) {

      const {
        data: account,
        error: accountError
      } =
        await supabase
          .from("fwebaccount")
          .select(
            "fcoins"
          )
          .eq(
            "id",
            userId
          )
          .maybeSingle();


      if (accountError) {

        throw accountError;

      }


      if (account) {

        fcoins =
          Number(
            account.fcoins
          ) || 0;

      }

    }


    /* =========================
       RESPONSE
    ========================= */

    return {

      success: true,

      fcoins,

      materials:
        formattedMaterials,

      pagination: {

        page,

        limit:
          MATERIALS_PER_PAGE,

        total:
          totalMaterials,

        total_pages:
          totalPages,

        has_next:
          page <
          totalPages,

        has_previous:
          page > 1

      }

    };


  } catch (err) {

    console.error(
      "❌ FMarket backend error:",
      err.message
    );


    return {

      success: false,

      error:
        err.message ||
        "Failed to load FMarket"

    };

  }

}