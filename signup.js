import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase =
  createClient(
    supabaseUrl,
    supabaseKey
  );

export default async function signup(
  req,
  res
) {

  try {

    const {
      id,
      username,
      firstName,
      lastName,
      email,
      avatar,
      provider
    } = req.body;

    // --------------------
    // VALIDATION
    // --------------------

    if (
      !id ||
      !username ||
      !email
    ) {

      return res
      .status(400)
      .json({
        success: false,
        message:
        "Missing required fields"
      });

    }

    // --------------------
    // CHECK EMAIL
    // --------------------

    const {
      data: existingEmail
    } =
    await supabase
    .from(
      "fwebaccount"
    )
    .select(
      "id"
    )
    .eq(
      "email",
      email
    )
    .maybeSingle();

    if (
      existingEmail
    ) {

      return res
      .status(409)
      .json({
        success: false,
        message:
        "Email already exists"
      });

    }

    // --------------------
    // CHECK USERNAME
    // --------------------

    const {
      data: existingUsername
    } =
    await supabase
    .from(
      "fwebaccount"
    )
    .select(
      "id"
    )
    .eq(
      "username",
      username
    )
    .maybeSingle();

    if (
      existingUsername
    ) {

      return res
      .status(409)
      .json({
        success: false,
        message:
        "Username already taken"
      });

    }

    // --------------------
    // STATUS
    // --------------------

    const status =
      provider ===
      "google"
      ? "active"
      : "pending";

    // --------------------
    // FULL NAME
    // --------------------

    const full_name =
      `${firstName || ""}
      ${lastName || ""}`
      .trim();

    // --------------------
    // INSERT ACCOUNT
    // --------------------

    const {
      data: newUser,
      error: insertError
    } =
    await supabase
    .from(
      "fwebaccount"
    )
    .insert([
      {
        id,
        username,
        full_name,
        email,
        status,
        profile_pic:
          avatar || null
      }
    ])
    .select()
    .single();

    if (
      insertError
    ) {

      console.error(
        insertError
      );

      return res
      .status(500)
      .json({
        success: false,
        message:
        "Failed to create account"
      });

    }

    // --------------------
    // CREATE FAI MEMORY
    // --------------------

    const {
      error:
      memoryError
    } =
    await supabase
    .from(
      "fai_memory"
    )
    .insert({
      user_id:
      id,
      memory: {}
    });

    if (
      memoryError
    ) {

      console.log(
        "⚠️ FAI memory init failed:",
        memoryError.message
      );

    }

    return res.json({

      success: true,

      message:
      status ===
      "pending"
      ? "Verification email sent. Please verify your email."
      : "Account created successfully.",

      user:
      newUser

    });

  }

  catch (
    err
  ) {

    console.error(
      err
    );

    return res
    .status(500)
    .json({
      success: false,
      message:
      err.message
    });

  }

      }
