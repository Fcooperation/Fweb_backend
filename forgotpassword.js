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

export default async function forgotPassword(
  req,
  res
){

  try{

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
        "Email required"
      });

    }

    const {
      error
    } =
    await supabase
    .auth
    .resetPasswordForEmail(
      email,
      {
        redirectTo:
        "https://fcooperation.vercel.app/reset-password.html"
      }
    );

    if(
      error
    ){

      return res
      .status(400)
      .json({
        success:false,
        message:
        error.message
      });

    }

    return res.json({
      success:true,
      message:
      "Password reset email sent. Check your inbox and spam folder."
    });

  }
  catch(
    err
  ){

    return res
    .status(500)
    .json({
      success:false,
      message:
      err.message
    });

  }

}