// faccount.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://pwsxezhugsxosbwhkdvf.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 🔹 Login function
export async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.json({ success: false, error: "Email and password required" });
  }

  try {
    // 🔎 Look up user
    const { data: user, error } = await supabase
      .from("fwebaccount")
      .select("username, email, status, created_at, password_hash")
      .eq("email", email)
      .eq("password_hash", password) // ⚠️ plaintext for now
      .single();

    if (error || !user) {
      return res.json({ success: false, error: "Invalid credentials" });
    }

    // 🔹 Return user details
    return res.json({
      success: true,
      user: {
        status: user.status,
        email: user.email,
        username: user.username,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    return res.json({ success: false, error: err.message });
  }
}
