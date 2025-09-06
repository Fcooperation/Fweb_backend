// faccount.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://pwsxezhugsxosbwhkdvf.supabase.co";
const supabaseAnonKey = "YOUR_SUPABASE_ANON_KEY";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function login(req, res) {
  const body = req.body || {};
  const { email, password } = body;

  if (!email || !password) {
    return res.json({ success: false, error: "Email and password required" });
  }

  try {
    const { data: user, error } = await supabase
      .from("fwebaccount")
      .select("username, email, status, created_at, password_hash")
      .eq("email", email)
      .eq("password_hash", password) // ⚠ plaintext for now
      .single();

    if (error || !user) {
      return res.json({ success: false, error: "Invalid credentials" });
    }

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
