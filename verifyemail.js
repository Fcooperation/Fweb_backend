import {
  createClient
}
from "@supabase/supabase-js";

import "dotenv/config";

const supabase =
createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function verifyEmail(
  req,
  res
){

  try{

    console.log(
      "\n========== VERIFY EMAIL =========="
    );

    const {
      email
    } =
    req.body;

    if(
      !email
    ){

      return res
      .status(400)
      .json({
        success:false,
        message:
        "Email is required"
      });

    }

    console.log(
      "Resending verification to:",
      email
    );

    const {
      error
    } =
    await supabase
    .auth
    .resend({

      type:
      "signup",

      email,

      options:{
        emailRedirectTo:
        "https://fcooperation.vercel.app/verified.html"
      }

    });

    if(
      error
    ){

      console.log(
        "❌ Resend failed"
      );

      console.log(
        error
      );

      return res
      .status(400)
      .json({
        success:false,
        message:
        error.message
      });

    }

    console.log(
      "✅ Verification email sent"
    );

    return res.json({

      success:true,

      message:
      "Verification email sent successfully. Please check your inbox and spam folder."

    });

  }
  catch(
    err
  ){

    console.log(
      "💥 VERIFY EMAIL CRASHED"
    );

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