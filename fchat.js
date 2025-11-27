import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://pwsxezhugsxosbwhkdvf.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // **Use env variable on Render**
const supabase = createClient(supabaseUrl, supabaseKey);

export async function handleFChat(req, res) {
  const { action, email, password } = req.body;

  if (!action) return res.status(400).json({ error: "No action provided" });

  if (action === "login") {
    if (!email || !password) {
      return res.status(400).json({ error: "Missing email or password" });
    }

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

      const nowUTC = new Date(new Date().toISOString());
      const suspendedUntil = data.suspended_until ? new Date(data.suspended_until) : null;

      if (data.status === "banned") {
        return res.json({ status: "banned" });
      }

      if (data.status === "suspended" && suspendedUntil && suspendedUntil > nowUTC) {
        return res.json({ status: "suspended", suspended_until: data.suspended_until, user: data });
      }

      // If suspension expired, reactivate automatically
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
