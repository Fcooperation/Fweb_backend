import "dotenv/config";

import {
  createClient
} from "@supabase/supabase-js";

import {
  v2 as cloudinary
} from "cloudinary";


/* =========================
   SUPABASE
========================= */

const supabase =
  createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );


/* =========================
   CLOUDINARY
========================= */

cloudinary.config({

  cloud_name:
    process.env.CLOUDINARY_CLOUD_NAME,

  api_key:
    process.env.CLOUDINARY_API_KEY,

  api_secret:
    process.env.CLOUDINARY_API_SECRET

});


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
   UPLOAD IMAGE TO CLOUDINARY
========================= */

function uploadImageToCloudinary(
  buffer,
  folder = "fmarket"
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const stream =
        cloudinary.uploader.upload_stream(

          {
            folder,

            resource_type:
              "image",

            transformation: [

              {
                width: 1600,
                height: 1600,
                crop: "limit"
              },

              {
                quality: "auto"
              }

            ]

          },

          (
            error,
            result
          ) => {

            if (error) {

              reject(
                error
              );

              return;

            }

            resolve(
              result
            );

          }

        );


      stream.end(
        buffer
      );

    }
  );

}

/* =========================
   UPLOAD TEXTBOOK TO CLOUDINARY
========================= */

function uploadTextbookToCloudinary(
  buffer,
  originalName
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const stream =
        cloudinary.uploader.upload_stream(

          {
            folder:
              "fmarket/textbooks",

            resource_type:
              "raw",

            public_id:
              `${Date.now()}-${String(
                originalName || "textbook"
              )
                .replace(
                  /\.[^/.]+$/,
                  ""
                )
                .replace(
                  /[^a-zA-Z0-9-_]/g,
                  "-"
                )}`

          },

          (
            error,
            result
          ) => {

            if (error) {

              reject(
                error
              );

              return;

            }

            resolve(
              result
            );

          }

        );


      stream.end(
        buffer
      );

    }
  );

}


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
  file_url,
  material_type,
  note_data,
  past_questions_data,
  note_file_ids
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
        .select(
          "id, username"
        )
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
        .slice(
          0,
          120
        );


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
            .slice(
              0,
              2000
            )
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
   TEXTBOOK TYPE
========================= */

if (
  category === "textbook"
) {

  if (
    !material_type ||
    ![
      "digital",
      "physical"
    ].includes(
      material_type
    )
  ) {

    return res.status(400).json({

      success: false,

      error:
        "Invalid textbook type."

    });

  }


  /* =========================
     DIGITAL TEXTBOOK
  ========================= */

  if (
    material_type ===
    "digital"
  ) {

    if (
      condition !==
      "digital"
    ) {

      return res.status(400).json({

        success: false,

        error:
          "Digital textbooks must have a digital condition."

      });

    }

  }


  /* =========================
     PHYSICAL TEXTBOOK
  ========================= */

  if (
    material_type ===
    "physical"
  ) {

    if (
      !condition ||
      condition ===
      "digital"
    ) {

      return res.status(400).json({

        success: false,

        error:
          "Physical textbooks require a valid condition."

      });

    }

  }

}

    /* =========================
       CLEAN OPTIONAL DATA
    ========================= */

    const cleanCourse =
      course
        ? String(course)
            .trim()
            .slice(
              0,
              100
            )
        : null;


    const cleanUniversity =
      university
        ? String(university)
            .trim()
            .slice(
              0,
              150
            )
        : null;


    const cleanDepartment =
      department
        ? String(department)
            .trim()
            .slice(
              0,
              150
            )
        : null;


    const cleanLocation =
      location
        ? String(location)
            .trim()
            .slice(
              0,
              200
            )
        : null;


    const cleanFileUrl =
      file_url
        ? String(file_url)
            .trim()
            .slice(
              0,
              2000
            )
        : null;


    /* =========================
   MATERIAL DATA
========================= */

let cleanNoteData =
  null;


/*
 * FSTUDY NOTE
 */

if (note_data) {

  try {

    cleanNoteData =
      JSON.parse(
        note_data
      );

  } catch {

    return res.status(400).json({

      success: false,

      error:
        "Invalid FStudy note data."

    });

  }

}


/*
 * PAST QUESTIONS
 */

if (
  past_questions_data
) {

  try {

    cleanNoteData =
      JSON.parse(
        past_questions_data
      );

  } catch {

    return res.status(400).json({

      success: false,

      error:
        "Invalid past questions data."

    });

  }

}


    /* =========================
       FSTUDY IMAGE IDS
    ========================= */

    let parsedNoteFileIds =
      [];


    if (note_file_ids) {

      try {

        parsedNoteFileIds =
          JSON.parse(
            note_file_ids
          );

        if (
          !Array.isArray(
            parsedNoteFileIds
          )
        ) {

          parsedNoteFileIds =
            [];

        }

      } catch {

        return res.status(400).json({

          success: false,

          error:
            "Invalid FStudy image data."

        });

      }

    }


    /* =========================
       FILES FROM MULTER
    ========================= */

    const listingImage =
  req.files?.image?.[0] ||
  null;

const noteFiles =
  req.files?.note_files ||
  [];

const textbookFile =
  req.files?.textbook_file?.[0] ||
  null;


    /* =========================
       LISTING IMAGE
    ========================= */

    let imageUrl =
      null;


    if (listingImage) {

      if (
        !listingImage.mimetype ||
        !listingImage.mimetype.startsWith(
          "image/"
        )
      ) {

        return res.status(400).json({

          success: false,

          error:
            "The uploaded listing image must be an image."

        });

      }


      const uploadedImage =
        await uploadImageToCloudinary(
          listingImage.buffer,
          "fmarket"
        );


      imageUrl =
        uploadedImage.secure_url ||
        null;


      if (!imageUrl) {

        return res.status(500).json({

          success: false,

          error:
            "Listing image upload failed."

        });

      }

    }

/* =========================
   TEXTBOOK FILE
========================= */

let textbookFileUrl =
  cleanFileUrl;


/* =========================
   DIGITAL TEXTBOOK
========================= */

if (
  category === "textbook" &&
  material_type === "digital"
) {

  if (!textbookFile) {

    return res.status(400).json({

      success: false,

      error:
        "Digital textbook file is required."

    });

  }


  /* =========================
     ALLOWED TEXTBOOK TYPES
  ========================= */

  const allowedTextbookTypes = [
    "application/pdf",

    "application/epub+zip",

    "application/msword",

    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ];


  const allowedExtensions = [
    ".pdf",
    ".epub",
    ".doc",
    ".docx"
  ];


  const originalName =
    textbookFile.originalname ||
    "";


  const extension =
    originalName
      .toLowerCase()
      .slice(
        originalName.lastIndexOf(".")
      );


  if (
    !allowedTextbookTypes.includes(
      textbookFile.mimetype
    ) &&
    !allowedExtensions.includes(
      extension
    )
  ) {

    return res.status(400).json({

      success: false,

      error:
        "Invalid textbook file. Only PDF, EPUB, DOC and DOCX files are allowed."

    });

  }


  /* =========================
     MAX SIZE
  ========================= */

  const maxTextbookSize =
    100 *
    1024 *
    1024;


  if (
    textbookFile.size >
    maxTextbookSize
  ) {

    return res.status(400).json({

      success: false,

      error:
        "Textbook file is too large. Maximum size is 100MB."

    });

  }


  /* =========================
     UPLOAD TO CLOUDINARY
  ========================= */

  const uploadedTextbook =
    await uploadTextbookToCloudinary(
      textbookFile.buffer,
      originalName
    );


  textbookFileUrl =
    uploadedTextbook.secure_url ||
    null;


  if (
    !textbookFileUrl
  ) {

    return res.status(500).json({

      success: false,

      error:
        "Textbook upload failed."

    });

  }

}


/* =========================
   PHYSICAL TEXTBOOK
========================= */

if (
  category === "textbook" &&
  material_type === "physical"
) {

  /*
   * Physical textbooks do not
   * need a digital file.
   */

  textbookFileUrl =
    null;

}

    /* =========================
       FSTUDY NOTE IMAGES
    ========================= */

    if (
      cleanNoteData &&
      Array.isArray(
        cleanNoteData.files
      ) &&
      noteFiles.length > 0
    ) {

      for (
        let i = 0;
        i < noteFiles.length;
        i++
      ) {

        const file =
          noteFiles[i];

        const originalId =
          parsedNoteFileIds[i];


        /*
         * Only allow images.
         */
        if (
          !file.mimetype ||
          !file.mimetype.startsWith(
            "image/"
          )
        ) {

          return res.status(400).json({

            success: false,

            error:
              "All FStudy note files must be images."

          });

        }


        /*
         * Upload the actual
         * FStudy image to Cloudinary.
         */
        const uploadedNoteImage =
          await uploadImageToCloudinary(
            file.buffer,
            "fmarket/fstudy-notes"
          );


        const noteImageUrl =
          uploadedNoteImage.secure_url ||
          null;


        if (!noteImageUrl) {

          return res.status(500).json({

            success: false,

            error:
              "An FStudy note image failed to upload."

          });

        }


        /*
         * Find the matching
         * file inside note_data.
         */
        const noteFile =
          cleanNoteData.files.find(
            item =>
              item &&
              item.id ===
              originalId
          );


        if (noteFile) {

          /*
           * Keep the original
           * IndexedDB ID and metadata,
           * but add the permanent URL.
           */
          noteFile.url =
            noteImageUrl;

        }

      }

    }


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
            imageUrl,

          file_url:
  textbookFileUrl,

note_data:
  cleanNoteData,

material_type:
  category === "textbook"
    ? material_type
    : null,

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
note_data,
material_type,
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