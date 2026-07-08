import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl =
  process.env.SUPABASE_URL;

const supabaseKey =
  process.env.SUPABASE_KEY;

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

    console.log(
      "\n========== SIGNUP REQUEST =========="
    );

    console.log(
      "Incoming body:",
      JSON.stringify(
        req.body,
        null,
        2
      )
    );

    const {
      id,
      username,
      firstName,
      lastName,
      email,
      avatar,
      provider
    } = req.body;

    console.log(
      "Parsed values:",
      {
        id,
        username,
        firstName,
        lastName,
        email,
        avatar,
        provider
      }
    );

    // --------------------
    // VALIDATION
    // --------------------

    if (
      !id ||
      !username ||
      !email
    ) {

      console.log(
        "❌ Validation failed"
      );

      return res
      .status(400)
      .json({
        success: false,
        message:
          "Missing required fields"
      });

    }

    console.log(
      "✅ Validation passed"
    );

    // --------------------
    // CHECK EMAIL
    // --------------------

    console.log(
      "Checking email:",
      email
    );

    const {
      data: existingEmail,
      error: emailError
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
      emailError
    ) {

      console.log(
        "❌ Email check error:",
        emailError
      );

    }

    console.log(
      "Existing email result:",
      existingEmail
    );

    if (
      existingEmail
    ) {

      console.log(
        "❌ Email already exists"
      );

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

    console.log(
      "Checking username:",
      username
    );

    const {
      data:
        existingUsername,
      error:
        usernameError
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
      usernameError
    ) {

      console.log(
        "❌ Username check error:",
        usernameError
      );

    }

    console.log(
      "Existing username result:",
      existingUsername
    );

    if (
      existingUsername
    ) {

      console.log(
        "❌ Username already taken"
      );

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

    console.log(
      "Account status:",
      status
    );

    // --------------------
    // FULL NAME
    // --------------------

    const full_name =
      `${firstName || ""}
       ${lastName || ""}`
      .trim();

    console.log(
      "Full name:",
      full_name
    );

    // --------------------
    // INSERT ACCOUNT
    // --------------------

    const insertPayload = {
      id,
      username,
      full_name,
      email,
      status,
      profile_pic:
        avatar || null
    };

    console.log(
      "Insert payload:",
      insertPayload
    );

    const {
      data: newUser,
      error:
        insertError
    } =
    await supabase
      .from(
        "fwebaccount"
      )
      .insert([
        insertPayload
      ])
      .select()
      .single();

    console.log(
      "Insert result:",
      newUser
    );

    if (
      insertError
    ) {

      console.log(
        "❌ Insert failed:"
      );

      console.log(
        insertError
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Failed to create account",
          error:
            insertError.message
        });

    }

    console.log(
      "✅ User inserted successfully"
    );

    // --------------------
    // CREATE FAI MEMORY
    // --------------------

    console.log(
      "Creating FAI memory..."
    );

    const {
      error:
        memoryError
    } =
    await supabase
      .from(
        "fai_memory"
      )
      .insert({
        user_id: id,
        memory: {}
      });

    if (
      memoryError
    ) {

      console.log(
        "⚠️ FAI memory init failed:"
      );

      console.log(
        memoryError
      );

    } else {

      console.log(
        "✅ FAI memory initialized"
      );

    }

    console.log(
      "========== SIGNUP SUCCESS ==========\n"
    );

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

    console.log(
      "💥 SIGNUP CRASHED"
    );

    console.log(
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
