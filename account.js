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

    let {
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
    .single();

    console.log(
      "Account result:",
      account
    );

    console.log(
      "Account error:",
      accountError
    );

    if(
  !account
){

  console.log(
    "No local account found."
  );

  console.log(
    "Creating Google account..."
  );

  const provider =
  user.app_metadata
  ?.provider;

  // Only auto-create for Google users
  if(
    provider !==
    "google"
  ){

    return res
    .status(404)
    .json({
      success:false,
      message:
      "Account not found"
    });

  }

  const username =
  (
    user.user_metadata
    ?.name ||
    user.email
    .split("@")[0]
  )
  .toLowerCase()
  .replaceAll(
    " ",
    ""
  ) +
  Math.floor(
    Math.random() * 1000
  );

  const {
    data:newAccount,
    error:createError
  } =
  await supabase
  .from(
    "fwebaccount"
  )
  .insert({

    id:
    user.id,

    email:
    user.email,

    username,

    full_name:
    user.user_metadata
    ?.full_name ||

    user.user_metadata
    ?.name ||

    "",

    profile_pic:
    user.user_metadata
    ?.avatar_url ||

    null,

    status:
    "active"

  })
  .select()
  .single();

  if(
    createError
  ){

    console.log(
      createError
    );

    return res
    .status(500)
    .json({
      success:false,
      message:
      "Failed to create account"
    });

  }

  account =
  newAccount;

  console.log(
    "Google account created."
  );

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

  full_name:
  account.full_name,

  email:
  user.email,

  provider:
  user.app_metadata.provider,

  profile_pic:
  account.profile_pic,

  created_at:
  account.created_at,

  status:
  user.email_confirmed_at
  ? "active"
  : "pending"
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