import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function dashboard(req, res) {
  try {
    const body = req.body;
    const action = body.action;
    const email = body.email;

    if (!action) {
      return res.status(400).json({ error: "No action provided" });
    }

    const actionsList = [
      "check_status",
      "update_pic",
      "update_details",
      "delete_account",
      "check_fchat_access",
      "update_status_text",
      "update_broadcast"
    ];

    if (actionsList.includes(action)) {
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Fetch account
      const { data: account, error: accError } = await supabase
        .from("fwebaccount")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (accError || !account) {
        return res.status(404).json({ error: "Account not found" });
      }

      // --------------------
      // Status handling
      // --------------------
      let status = account.status || "active";
      let suspendedUntil = account.suspended_until
        ? new Date(account.suspended_until)
        : null;

      const now = new Date();

      if (status === "suspended" && suspendedUntil && suspendedUntil <= now) {
        await supabase
          .from("fwebaccount")
          .update({ status: "active" })
          .eq("email", email);

        status = "active";
      }

      // --------------------
      // CHECK STATUS
      // --------------------
      if (action === "check_status") {
        return res.json({
          status,
          suspended_until: suspendedUntil,
          banned: status === "banned",
          message: "Account status checked"
        });
      }

      // --------------------
      // UPDATE STATUS TEXT
      // --------------------
      if (action === "update_status_text") {
        const { status_text } = body;

        if (!status_text) {
          return res.status(400).json({ error: "No status text provided" });
        }

        const { data, error } = await supabase
          .from("fwebaccount")
          .update({ status_text })
          .eq("email", email)
          .select()
          .maybeSingle();

        if (error || !data) {
          return res.status(500).json({ error: "Failed to update status text" });
        }

        return res.json({
          success: true,
          message: "Status text updated",
          status_text: data.status_text,
          status
        });
      }

      // --------------------
      // UPDATE BROADCAST
      // --------------------
      if (action === "update_broadcast") {
        const { broadcast } = body;

        const value = broadcast === "yes" ? "yes" : null;

        const { data, error } = await supabase
          .from("fwebaccount")
          .update({ broadcast: value })
          .eq("email", email)
          .select()
          .maybeSingle();

        if (error || !data) {
          return res.status(500).json({ error: "Failed to update broadcast" });
        }

        return res.json({
          success: true,
          message: "Broadcast updated",
          broadcast: data.broadcast,
          status
        });
      }

      // --------------------
      // UPDATE PROFILE PIC
      // --------------------
      if (action === "update_pic") {
        const { profile_pic } = body;

        if (!profile_pic) {
          return res.status(400).json({ error: "No image provided" });
        }

        const { data, error } = await supabase
          .from("fwebaccount")
          .update({ profile_pic })
          .eq("email", email)
          .select()
          .maybeSingle();

        if (error || !data) {
          return res.status(500).json({ error: "Failed to update profile picture" });
        }

        return res.json({
          success: true,
          message: "Profile picture updated",
          profile_pic: data.profile_pic,
          status
        });
      }

      // --------------------
      // UPDATE DETAILS
      // --------------------
      if (action === "update_details") {
        const { username, password_hash, dob, bio, fchat } = body;

        const updates = {};
        if (username) updates.username = username;
        if (password_hash) updates.password_hash = password_hash;
        if (dob) updates.dob = dob;
        if (bio) updates.bio = bio;
        if (fchat) updates.fchat = fchat;

        if (Object.keys(updates).length === 0) {
          return res.status(400).json({ error: "No details to update" });
        }

        const { data, error } = await supabase
          .from("fwebaccount")
          .update(updates)
          .eq("email", email)
          .select()
          .maybeSingle();

        if (error || !data) {
          return res.status(500).json({ error: "Failed to update details" });
        }

        return res.json({
          success: true,
          message: "Account updated",
          ...data
        });
      }

      // --------------------
      // DELETE ACCOUNT
      // --------------------
      if (action === "delete_account") {
        const { error } = await supabase
          .from("fwebaccount")
          .delete()
          .eq("email", email);

        if (error) {
          return res.status(500).json({ error: "Failed to delete account" });
        }

        return res.json({
          success: true,
          message: "Account deleted"
        });
      }

      // --------------------
      // CHECK FCHAT ACCESS
      // --------------------
      if (action === "check_fchat_access") {
        const canAccess =
          status === "active" &&
          account.fchat?.toLowerCase() === "yes";

        return res.json({
          fchat: canAccess ? "yes" : "no",
          status,
          banned: status === "banned",
          suspended_until: suspendedUntil
        });
      }
    }

    return res.status(400).json({ error: "Invalid action" });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
                                   }
