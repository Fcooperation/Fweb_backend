import { createClient } from "@supabase/supabase-js";

// Supabase client
const supabaseUrl = "https://pwsxezhugsxosbwhkdvf.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ"; // Replace with your hardcoded key or env variable
const supabase = createClient(supabaseUrl, supabaseKey);

export async function handleFChat(body) {
  try {
    console.log("📩 FCHAT received:", body);
    const { action, email, password } = body;

    if (!action) return { error: "No action provided" };

    if (action === "login") {
      if (!email || !password) {
        return { error: "Missing email or password" };
      }

      // Fetch account from Supabase
      const { data, error } = await supabase
        .from("fwebaccount")
        .select("*")
        .eq("email", email)
        .single();

      if (error || !data) {
        return { error: "Account not found" };
      }

      // Check password
      if (data.password_hash !== password) {
        return { error: "Invalid password" };
      }

      // Check account status
      const nowUTC = new Date();
      let responseStatus = data.status;

      if (data.status === "suspended") {
        const suspendedUntil = data.suspended_until ? new Date(data.suspended_until) : null;
        if (suspendedUntil && suspendedUntil <= nowUTC) {
          // Suspension expired → reactivate
          await supabase
            .from("fwebaccount")
            .update({ status: "active" })
            .eq("email", email);
          responseStatus = "active";
        }
      }

      // Return full account details including status
      return {
        message: "Login processed",
        status: responseStatus,
        user: data // full row from Supabase, frontend can save to localStorage
      };
    }
    if (action === "signup") {
const { username, full_name, secret } = body;

// Basic validation
if (!email || !password || !username || !full_name || !secret) {
return { error: "Please provide all required fields" };
}

// Check if email already exists
const { data: existingUser, error: checkError } = await supabase
.from("fwebaccount")
.select("*")
.eq("email", email)
.maybeSingle();

if (checkError) {
console.error("Error checking existing email:", checkError);
return { error: "Error checking email" };
}

if (existingUser) {
return { error: "Email already exists. Please login." };
}

// Generate a unique numeric ID (up to 15 digits)
let uniqueId;
while (true) {
uniqueId = Math.floor(Math.random() * 1e15);
const { data: idCheck } = await supabase
.from("fwebaccount")
.select("id")
.eq("id", uniqueId)
.maybeSingle();
if (!idCheck) break; // ID is unique
}

// Insert new account
const { data: newUser, error: insertError } = await supabase
.from("fwebaccount")
.insert([
{
id: uniqueId,
username,
full_name,
email,
password_hash: password,
secret,
status: "active"
}
])
.select()
.maybeSingle();

if (insertError || !newUser) {
console.error("Error creating account:", insertError);
return { error: "Failed to create account" };
}

// Return success message and full user details
return {
status: "success",
message: "Account created successfully. You can now login.",
user: newUser
};
  }
    // --------------------
// Forget Password: Step 1 - check email exists
// --------------------
if (action === "forgetpassword") {
  if (!email) return { error: "Email is required" };

  const { data, error } = await supabase
    .from("fwebaccount")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error || !data) return { error: "Email not found" };

  // Don't send password, just acknowledge
  return { message: "Email exists. Please enter your secret code." };
}

// --------------------
// Verify secret code
// --------------------
if (action === "verifysecret") {
  const { secret } = body;
  if (!email || !secret) return { error: "Email and secret are required" };

  const { data, error } = await supabase
    .from("fwebaccount")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error || !data) return { error: "Account not found" };
  if (data.secret !== secret) return { error: "Secret code does not match" };

  return { message: "Secret verified" };
}

// --------------------
// Change password
// --------------------
if (action === "changepassword") {
  const { new_password } = body;
  if (!email || !new_password) return { error: "Email and new password required" };

  const { data, error } = await supabase
    .from("fwebaccount")
    .update({ password_hash: new_password })
    .eq("email", email)
    .select()
    .maybeSingle();

  if (error || !data) return { error: "Failed to update password" };

  return { message: "Password changed successfully" };
}
    // --------------------  
// Dashboard / Account actions  
// --------------------  
if (
  [
    "check_status",
    "update_pic",
    "update_details",
    "delete_account",
    "check_fchat_access"
  ].includes(action)
) {
  // Fetch account
  const { data: account, error: accError } = await supabase
    .from("fwebaccount")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (accError || !account) return { error: "Account not found" };

  // --------------------
  // Check status (banned/suspended)
  // --------------------
  let status = account.status || "active";
  let suspendedUntil = account.suspended_until ? new Date(account.suspended_until) : null;
  const now = new Date();

  if (status === "suspended" && suspendedUntil && suspendedUntil <= now) {
    // Reactivate expired suspension
    await supabase
      .from("fwebaccount")
      .update({ status: "active" })
      .eq("email", email);
    status = "active";
  }

  // --------------------
  // Handle specific actions
  // --------------------
  if (action === "check_status") {
    return {
      status,
      suspended_until: suspendedUntil,
      banned: status === "banned",
      message: "Account status checked",
    };
  }

  if (action === "update_pic") {
    const { profile_pic } = body;
    if (!profile_pic) return { error: "No image provided" };

    const { data: updatedPic, error: picError } = await supabase
      .from("fwebaccount")
      .update({ profile_pic })
      .eq("email", email)
      .select()
      .maybeSingle();

    if (picError || !updatedPic) return { error: "Failed to update profile picture" };

    return {
      success: true,
      message: "Profile picture updated successfully",
      profile_pic: updatedPic.profile_pic,
      status // always send status
    };
  }

 if (action === "update_details") {
  const { username, password_hash, dob, bio, fchat } = body;
  const updates = {};
  if (username) updates.username = username;
  if (password_hash) updates.password_hash = password_hash;
  if (dob) updates.dob = dob;
  if (bio) updates.bio = bio;
  if (fchat) updates.fchat = fchat;

  if (Object.keys(updates).length === 0) return { error: "No details to update" };

  const { data: updatedDetails, error: updError } = await supabase
    .from("fwebaccount")
    .update(updates)
    .eq("email", email)
    .select()
    .maybeSingle();

  if (updError || !updatedDetails) return { error: "Failed to update details" };

  return {
    success: true,
    message: "Account details updated successfully",
    ...updatedDetails
  };
     }

  if (action === "delete_account") {
    const { error: delError } = await supabase
      .from("fwebaccount")
      .delete()
      .eq("email", email);

    if (delError) return { error: "Failed to delete account" };

    return { success: true, message: "Account deleted successfully" };
  }

  if (action === "check_fchat_access") {
    // Active status is required
    const canAccess = status === "active" && account.fchat?.toLowerCase() === "yes";
    return {
      fchat: canAccess ? "yes" : "no",
      status,
      banned: status === "banned",
      suspended_until: suspendedUntil
    };
  }
}


    // Incremental / search actions

if(action==="get_all_users"){
const { data, error } = await supabase
.from("fwebaccount")
.select("id, username, profile_pic, fchat, friend_requests, fchat_messages, broadcast");
if(error) return { error:"Failed to fetch users" };
return { data };
}

  


if(action==="send_friend_request"){
const { target_id, friend_requests, sent_at } = body;
if(!target_id) return { error:"Target ID required" };

const { data, error } = await supabase
.from("fwebaccount")
.update({ friend_requests, sent_at })
.eq("id", target_id)
.select()
.maybeSingle();

if(error||!data) return { error:"Failed to send friend request" };
return { message:"Friend request sent", data };
  }
    return { message: "Action not supported yet" };

  } catch (err) {
    console.error("❌ handleFChat error:", err);
    return { error: "Something went wrong" };
      }        
}
