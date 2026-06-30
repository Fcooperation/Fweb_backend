import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function fvidLike(req, res) {

  try {

    const { videoId, userId, action } = req.body;

    if (!videoId || !userId) {
      return res.status(400).json({
        success: false,
        error: "Missing videoId or userId"
      });
    }

    const uid = String(userId);

    // ==========================================
    // UPDATE fvid_likes TABLE FIRST
    // ==========================================

    if (action === "like") {

      // Check if already liked
      const { data: existingLike } = await supabase
        .from("fvid_likes")
        .select("id")
        .eq("video_id", videoId)
        .eq("user_id", uid)
        .maybeSingle();

      if (!existingLike) {
        const { error } = await supabase
          .from("fvid_likes")
          .insert({
            video_id: videoId,
            user_id: uid
          });

        if (error) throw error;
      }

    } else if (action === "unlike") {

      const { error } = await supabase
        .from("fvid_likes")
        .delete()
        .eq("video_id", videoId)
        .eq("user_id", uid);

      if (error) throw error;
    }

    // ==========================================
    // YOUR EXISTING likes COLUMN UPDATE
    // ==========================================

    const { data: video, error: fetchError } = await supabase
      .from("fvids")
      .select("likes")
      .eq("id", videoId)
      .single();

    if (fetchError) throw fetchError;

    let likes = [];

    try {
      likes = video.likes ? JSON.parse(video.likes) : [];
    } catch (e) {
      likes = [];
    }

    if (action === "like") {

      if (!likes.includes(uid)) {
        likes.push(uid);
      }

    } else if (action === "unlike") {

      likes = likes.filter(id => id !== uid);

    }

    const likesCount = likes.length;

    const { error: updateError } = await supabase
      .from("fvids")
      .update({
        likes: JSON.stringify(likes),
        likes_count: likesCount
      })
      .eq("id", videoId);

    if (updateError) throw updateError;

    return res.json({
      success: true,
      liked: action === "like",
      likes_count: likesCount
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      success: false,
      error: err.message
    });

  }

        }
