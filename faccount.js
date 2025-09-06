// faccount.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://pwsxezhugsxosbwhkdvf.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 🔹 Login: fetch user and check status
export async function login({ email, password }) {
  let { data, error } = await supabase
    .from("fwebaccount")
    .select("username, email, status, created_at, suspended_until") // ✅ include suspended_until
    .eq("email", email)
    .eq("password_hash", password) // plaintext for now
    .single();

  if (error || !data) {
    throw new Error("Invalid credentials");
  }

  // 🔹 Handle suspension expiry
  if (data.status === "suspended" && data.suspended_until) {
    const now = new Date();
    const until = new Date(data.suspended_until);

    if (now >= until) {
      // suspension expired → update to active
      await supabase
        .from("fwebaccount")
        .update({ status: "active", suspended_until: null })
        .eq("email", data.email);

      data.status = "active";
      data.suspended_until = null;
    }
  }

  // 🔹 Return info
  return {
    status: data.status,
    email: data.email,
    username: data.username,
    created_at: data.created_at,
    suspended_until: data.suspended_until,
  };
}
