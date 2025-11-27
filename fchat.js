import { createClient } from "@supabase/supabase-js";

// Supabase setup
const supabaseUrl = "https://pwsxezhugsxosbwhkdvf.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function handleFChat(req, res) {
if (!req.body) return res.status(400).json({ error: "No request body" });

const { action, email, password } = req.body;

if (!action) return res.status(400).json({ error: "No action provided" });

// ----- LOGIN -----
if (action === "login") {
if (!email || !password) return res.status(400).json({ error: "Missing email or password" });

try {
  const { data, error } = await supabase
    .from("fwebaccount")
    .select("*")
    .eq("email", email)
    .single();

  if (error || !data) {
    return res.json({ error: "Account not found" });
  }

  if (data.password_hash !== password) {
    return res.json({ error: "Invalid password" });
  }

  const nowUTC = new Date();
  const suspendedUntil = data.suspended_until ? new Date(data.suspended_until) : null;

  if (data.status === "banned") {
    return res.json({ status: "banned" });
  }

  if (data.status === "suspended" && suspendedUntil && suspendedUntil > nowUTC) {
    return res.json({ status: "suspended", suspended_until: data.suspended_until, user: data });
  }

  // If suspension expired, reactivate
  if (data.status === "suspended" && suspendedUntil && suspendedUntil <= nowUTC) {
    await supabase
      .from("fwebaccount")
      .update({ status: "active" })
      .eq("email", email);
    data.status = "active";
  }

  return res.json({ status: data.status, user: data });
} catch (err) {
  console.error("❌ FChat login error:", err.message);
  return res.status(500).json({ error: "Internal server error" });
}

}

return res.status(400).json({ error: "Unsupported action" });
      }
