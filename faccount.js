// faccount.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://pwsxezhugsxosbwhkdvf.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 🔹 Signup function
async function signup({ firstname, lastname, email, password }) {
  const username = `${firstname} ${lastname}`.trim();

  const { data, error } = await supabase
    .from("fwebaccount")
    .insert([
      {
        username,
        email,
        password_hash: password,
        status: "active",
      },
    ])
    .select();

  if (error) throw error;
  return data[0];
}

// 🔹 Login function
async function login({ email, password }) {
  const { data, error } = await supabase
    .from("fwebaccount")
    .select("username, email, password_hash")
    .eq("email", email)
    .eq("password_hash", password)
    .single();

  if (error || !data) {
    throw new Error("Invalid credentials");
  }

  return { username: data.username, email: data.email };
}

// ✅ Export to match your current index.js imports
export { signup, login };
