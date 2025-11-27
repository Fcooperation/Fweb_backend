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

    return { message: "Action not supported yet" };

  } catch (err) {
    console.error("❌ handleFChat error:", err);
    return { error: "Something went wrong" };
      }        
}
