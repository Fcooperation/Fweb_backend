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

export default async function account(
  req,
  res
){

  try{

    console.log(
      "\n========== ACCOUNT REQUEST =========="
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
        "No authorization token"
      });

    }

    const token =
      authHeader.replace(
        "Bearer ",
        ""
      );

    console.log(
      "Token received"
    );

    // --------------------
    // VERIFY TOKEN
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

      console.log(
        "❌ Invalid token"
      );

      console.log(
        userError
      );

      return res
      .status(401)
      .json({
        success:false,
        message:
        "Invalid token"
      });

    }

    console.log(
      "✅ Token belongs to:",
      user.id
    );

    console.log(
      "User email:",
      user.email
    );

    // --------------------
    // GET ACCOUNT
    // --------------------

    const {
      data: account,
      error: accountError
    } =
    await supabase
    .from(
      "fwebaccount"
    )
    .select("*")
    .eq(
      "email",
      user.email
    )
    .maybesingle();

    console.log(
      "Account result:",
      account
    );

    console.log(
      "Account error:",
      accountError
    );

    if(
      accountError ||
      !account
    ){

      console.log(
        "❌ Account fetch failed"
      );

      console.log(
        accountError
      );

      return res
      .status(404)
      .json({
        success:false,
        message:
        "Account not found"
      });

    }

    console.log(
      "✅ Account loaded"
    );

    return res.json({
      success:true,
      id:
      account.id,
      username:
      account.username,
      profile_pic:
      account.profile_pic,
      created_at:
      account.created_at,
      status:
      account.status
    });

  }
  catch(
    err
  ){

    console.log(
      "💥 ACCOUNT CRASHED"
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