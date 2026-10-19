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

// --------------------
// GET LOCATION FROM IP
// --------------------

async function getUserLocation(req) {

  try {

    // Get the connecting IP address.
    // Configure trusted proxy handling on your host.
    const forwardedFor =
      req.headers["x-forwarded-for"];

    const ip = forwardedFor
      ? forwardedFor.split(",")[0].trim()
      : req.socket.remoteAddress;

    if (!ip) {
      return null;
    }

    // Ignore local/private addresses.
    if (
      ip === "127.0.0.1" ||
      ip === "::1" ||
      ip.startsWith("10.") ||
      ip.startsWith("192.168.") ||
      ip.startsWith("172.")
    ) {
      return null;
    }

    const response = await fetch(
      `https://ipapi.co/${encodeURIComponent(ip)}/json/`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.error) {
      return null;
    }

    return {
      country: data.country_name || null,
      region: data.region || null,
      city: data.city || null
    };

  } catch (error) {

    console.error(
      "Location lookup failed:",
      error.message
    );

    return null;

  }

}

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
  password,
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

if (
  provider !== "google" &&
  !password
) {

  console.log(
    "❌ Password missing"
  );

  return res
  .status(400)
  .json({
    success: false,
    message:
      "Password required"
  });

}

    console.log(
      "✅ Validation passed"
    );

    // --------------------
// GET SIGNUP LOCATION
// --------------------

const signupLocation =
  await getUserLocation(req);

console.log(
  "Signup location:",
  signupLocation
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
// EMAIL SIGNUP
// --------------------

let userId = id;

if (
  provider !== "google"
) {

  console.log(
    "Creating Supabase auth user..."
  );

  const {
  data: authData,
  error: authError
} =
await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo:
      "https://fcooperation.vercel.app/verified.html"
  }
});

console.log(
  "Auth data:",
  JSON.stringify(
    authData,
    null,
    2
  )
);

console.log(
  "Auth error:",
  JSON.stringify(
    authError,
    null,
    2
  )
);

  if (
    authError
  ) {

    console.log(
      "❌ Auth signup failed:"
    );

    
    return res
    .status(500)
    .json({
      success: false,
      message:
      authError.message
    });

  }

  userId =
  authData.user.id;

  console.log(
    "✅ Verification email sent"
  );

}

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
  id:
  userId,
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
// SAVE USER LOCATION
// --------------------

if (signupLocation) {

  const {
    error: locationError
  } = await supabase
    .from("user_locations")
    .insert({
      user_id: userId,

      current_country:
        signupLocation.country,

      current_region:
        signupLocation.region,

      current_city:
        signupLocation.city,

      previous_country: null,
      previous_region: null,
      previous_city: null,

      updated_at: new Date().toISOString()
    });

  if (locationError) {

    console.error(
      "Location save failed:",
      locationError.message
    );

  } else {

    console.log(
      "✅ User location saved"
    );

  }

}

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
        user_id: userId,
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
? "Verification email sent to your email address."
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