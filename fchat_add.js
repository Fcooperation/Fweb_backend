import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl =
  process.env.SUPABASE_URL;

const supabaseKey =
  process.env.SUPABASE_KEY;

const supabase =
  createClient(
    supabaseUrl,
    supabaseKey
  );

export default async function addUser(
  req,
  res
) {

  try {

    const {
      userId,
      friendId
    } = req.body;

    // validation
    if (!userId || !friendId) {
      return res.status(400).json({
        success: false,
        error: "Missing userId or friendId"
      });
    }

    // prevent sending request to self
    if (userId === friendId) {
      return res.status(400).json({
        success: false,
        error: "You cannot add yourself"
      });
    }

    // check existing request
    const {
      data: existing
    } = await supabase
      .from("friend_request")
      .select("id")
      .or(
        `and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`
      )
      .maybeSingle();

    if (existing) {
      return res.status(409).json({
        success: false,
        error: "Friend request already exists"
      });
    }

    // insert request
    const {
      data,
      error
    } = await supabase
      .from("friend_request")
      .insert([
        {
          user_id: userId,
          friend_id: friendId,
          accepted: false,
          created_at:
            new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      request: data
    });

  } catch (err) {

    console.error(
      "ADD USER ERROR:",
      err
    );

    return res.status(500).json({
      success: false,
      error: err.message
    });

  }

}