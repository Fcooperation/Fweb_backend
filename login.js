data createClient } from "@supabase/supabase-js";
import 'dotenv/config';

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Missing email or password" });
    }

    // Fetch account
    const { data, error } = await supabase
      .from("fwebaccount")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Account not found" });
    }

    // Check password
    if (data.password_hash !== password) {
      return res.status(401).json({ error: "Invalid password" });
    }

    // Status handling
    const nowUTC = new Date();
    let responseStatus = data.status;

    if (data.status === "suspended") {
      const suspendedUntil = data.suspended_until
        ? new Date(data.suspended_until)
        : null;

      if (suspendedUntil && suspendedUntil <= nowUTC) {
        await supabase
          .from("fwebaccount")
          .update({ status: "active" })
          .eq("email", email);

        responseStatus = "active";
      }
    }

    // -----------------------------
// GET CHAT USERS FROM fchat_messages COLUMN
// -----------------------------

let chatUsers = [];

if (data.fchat_messages) {
  // convert "1,2,3" OR "1 2 3" OR single id into array
  const ids = data.fchat_messages
    .toString()
    .split(/[,\\s]+/)
    .filter(Boolean);

  const { data: users } = await supabase
    .from("fwebaccount")
    .select("id, username, profile_pic")
    .in("id", ids);

  chatUsers = users || [];
}

    // -----------------------------
    // SAFE USER (remove password)
    // -----------------------------
    const { password_hash, ...safeUser } = data;

    return res.json({
      message: "Login successful",
      status: responseStatus,
      user: safeUser,
      chatUsers
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
                          }
