// faccount.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://pwsxezhugsxosbwhkdvf.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 🔹 Login: fetch user and check status
export async function login({ email, password }) {
  const { data, error } = await supabase
    .from("fwebaccount")
    .select("username, email, password_hash, status")
    .eq("email", email)
    .eq("password_hash", password) // plain for now
    .single();

  if (error || !data) {
    throw new Error("Invalid credentials");
  }

  // Check status
  if (data.status === "active") {
    return { status: "active", username: data.username };
  } else {
    return { status: "not active", username: data.username };
  }
}
