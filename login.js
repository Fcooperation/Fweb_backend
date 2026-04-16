import { createClient } from "@supabase/supabase-js";
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
    // GET CHAT PARTNERS
    // -----------------------------
    const { data: messages } = await supabase
      .from("fchatmessages")
      .select("sender_id, receiver_id")
      .or(`sender_id.eq.${data.id},receiver_id.eq.${data.id}`);

    let chatUsers = [];

    if (messages && messages.length > 0) {
      const userIds = new Set();

      messages.forEach(msg => {
        if (msg.sender_id !== data.id) userIds.add(msg.sender_id);
        if (msg.receiver_id !== data.id) userIds.add(msg.receiver_id);
      });

      const { data: users } = await supabase
        .from("fwebaccount")
        .select("id, username, profile_pic")
        .in("id", [...userIds]);

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
