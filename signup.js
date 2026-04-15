import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// Supabase setup (same style as login)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function signup(req, res) {
  try {
    const body = req.body;
    const action = body.action;

    const email = body.email;
    const password = body.password;

    // --------------------
    // SIGNUP
    // --------------------
    if (action === "signup") {
      const { username, full_name, secret } = body;

      if (!email || !password || !username || !full_name || !secret) {
        return res.status(400).json({ error: "Please provide all required fields" });
      }

      // Check if email exists
      const { data: existingUser, error: checkError } = await supabase
        .from("fwebaccount")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (checkError) {
        console.error(checkError);
        return res.status(500).json({ error: "Error checking email" });
      }

      if (existingUser) {
        return res.status(409).json({ error: "Email already exists. Please login." });
      }

      // Generate unique ID
      let uniqueId;

      while (true) {
        uniqueId = Math.floor(Math.random() * 1e15);

        const { data: idCheck } = await supabase
          .from("fwebaccount")
          .select("id")
          .eq("id", uniqueId)
          .maybeSingle();

        if (!idCheck) break;
      }

      // Insert user
      const { data: newUser, error: insertError } = await supabase
        .from("fwebaccount")
        .insert([
          {
            id: uniqueId,
            username,
            full_name,
            email,
            password_hash: password,
            secret,
            status: "active"
          }
        ])
        .select()
        .maybeSingle();

      if (insertError || !newUser) {
        console.error(insertError);
        return res.status(500).json({ error: "Failed to create account" });
      }

      return res.json({
        status: "success",
        message: "Account created successfully. You can now login.",
        user: newUser
      });
    }

    // --------------------
    // FORGOT PASSWORD (STEP 1)
    // --------------------
    if (action === "forgetpassword") {
      if (!email) return res.status(400).json({ error: "Email is required" });

      const { data, error } = await supabase
        .from("fwebaccount")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (error || !data) {
        return res.status(404).json({ error: "Email not found" });
      }

      return res.json({
        message: "Email exists. Please enter your secret code."
      });
    }

    // --------------------
    // VERIFY SECRET
    // --------------------
    if (action === "verifysecret") {
      const { secret } = body;

      if (!email || !secret) {
        return res.status(400).json({ error: "Email and secret are required" });
      }

      const { data, error } = await supabase
        .from("fwebaccount")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (error || !data) {
        return res.status(404).json({ error: "Account not found" });
      }

      if (data.secret !== secret) {
        return res.status(401).json({ error: "Secret code does not match" });
      }

      return res.json({ message: "Secret verified" });
    }

    // --------------------
    // CHANGE PASSWORD
    // --------------------
    if (action === "changepassword") {
      const { new_password } = body;

      if (!email || !new_password) {
        return res.status(400).json({ error: "Email and new password required" });
      }

      const { data, error } = await supabase
        .from("fwebaccount")
        .update({ password_hash: new_password })
        .eq("email", email)
        .select()
        .maybeSingle();

      if (error || !data) {
        return res.status(500).json({ error: "Failed to update password" });
      }

      return res.json({
        message: "Password changed successfully"
      });
    }

    return res.status(400).json({ error: "No valid action provided" });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
