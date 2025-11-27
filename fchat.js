import { createClient } from "@supabase/supabase-js";

// Supabase client
const supabaseUrl = "https://pwsxezhugsxosbwhkdvf.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ";
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

      // ------------------------------
      // Query Supabase for email
      // ------------------------------
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

      // Login successful
      return {
        message: "Login successful",
        user: {
          email: data.email,
          status: data.status,
          suspended_until: data.suspended_until,
          // add other fields if needed
        }
      };
    }

    // If other actions are added later
    return { message: "Action not supported yet" };

  } catch (err) {
    console.error("❌ handleFChat error:", err);
    return { error: "Something went wrong" };
  }
        }
