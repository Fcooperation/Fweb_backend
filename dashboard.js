import {
  createClient
}
from "@supabase/supabase-js";

import {
  v2 as cloudinary
}
from "cloudinary";

import "dotenv/config";

const supabase =
createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

cloudinary.config({
  cloud_name:
  process.env.CLOUDINARY_CLOUD_NAME,

  api_key:
  process.env.CLOUDINARY_API_KEY,

  api_secret:
  process.env.CLOUDINARY_API_SECRET
});

export default async function dashboard(
  req,
  res
){

  try{

    console.log(
      "\n========== DASHBOARD =========="
    );

    // --------------------
    // GET TOKEN
    // --------------------

    const authHeader =
    req.headers.authorization;

    if(
      !authHeader
    ){

      return res
      .status(401)
      .json({
        success:false,
        message:
        "No token provided"
      });

    }

    const token =
    authHeader.replace(
      "Bearer ",
      ""
    );

    // --------------------
    // VERIFY USER
    // --------------------

    const {
      data:{
        user
      },
      error:userError
    } =
    await supabase
    .auth
    .getUser(
      token
    );

    if(
      userError ||
      !user
    ){

      return res
      .status(401)
      .json({
        success:false,
        message:
        "Invalid token"
      });

    }

    console.log(
      "User:",
      user.email
    );

    // --------------------
    // CHECK FILE
    // --------------------

    if(
      !req.file
    ){

      return res
      .status(400)
      .json({
        success:false,
        message:
        "No image uploaded"
      });

    }

    console.log(
      "Uploading to Cloudinary..."
    );

    // --------------------
    // UPLOAD TO CLOUDINARY
    // --------------------

    const upload =
    await cloudinary
    .uploader
    .upload(
      req.file.path,
      {
        folder:
        "fweb/profile_pics",

        public_id:
        user.id,

        overwrite:true,

        resource_type:
        "image"
      }
    );

    console.log(
      "Cloudinary upload complete"
    );

    const imageUrl =
    upload.secure_url;

    // --------------------
    // SAVE URL TO SUPABASE
    // --------------------

    const {
      error:updateError
    } =
    await supabase
    .from(
      "fwebaccount"
    )
    .update({
      profile_pic:
      imageUrl
    })
    .eq(
      "email",
      user.email
    );

    if(
      updateError
    ){

      console.log(
        updateError
      );

      return res
      .status(500)
      .json({
        success:false,
        message:
        "Failed to save profile picture"
      });

    }

    console.log(
      "Profile picture updated"
    );

    return res.json({

      success:true,

      message:
      "Profile picture updated successfully",

      profile_pic:
      imageUrl

    });

  }
  catch(
    err
  ){

    console.log(
      err
    );

    return res
    .status(500)
    .json({
      success:false,
      message:
      err.message
    });

  }

}