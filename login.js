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

export default async function login(
  req,
  res
){

  try{

    console.log(
      "\n========== LOGIN REQUEST =========="
    );

    const {
      email,
      password
    } = req.body;

    console.log(
      "Email:",
      email
    );

    // --------------------
    // VALIDATION
    // --------------------

    if(
      !email ||
      !password
    ){

      return res
      .status(400)
      .json({
        success:false,
        message:
        "Email and password required"
      });

    }

    // --------------------
    // LOGIN WITH SUPABASE
    // --------------------

    const {
      data,
      error
    } =
    await supabase
    .auth
    .signInWithPassword({
      email,
      password
    });

    if(
      error
    ){

      console.log(
        "❌ Login failed"
      );

      console.log(
        error
      );

      return res
      .status(401)
      .json({
        success:false,
        message:
        error.message
      });

    }

    console.log(
      "✅ Login successful"
    );

    const user =
      data.user;

    const session =
      data.session;

    // --------------------
    // GET ACCOUNT DETAILS
    // --------------------

    const {
      data: account,
      error: accountError
    } =
    await supabase
    .from(
      "fwebaccount"
    )
    .select(`
      username,
      profile_pic,
      status
    `)
    .eq(
      "email",
      email
    )
    .single();

    if(
      accountError
    ){

      console.log(
        "⚠️ Account lookup failed"
      );

      console.log(
        accountError
      );

    }

    return res.json({

      success:true,

      message:
      "Login successful",

      access_token:
      session.access_token,

      refresh_token:
      session.refresh_token,

      user:{
        id:
        user.id,

        email:
        user.email,

        username:
        account?.username || null,

        profile_pic:
        account?.profile_pic || null,

        status:
        account?.status || null
      }

    });

  }
  catch(
    err
  ){

    console.log(
      "💥 LOGIN CRASHED"
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
