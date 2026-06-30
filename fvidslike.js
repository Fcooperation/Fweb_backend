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

    // get current likes
    const { data: video, error: fetchError } = await supabase
      .from("fvids")
      .select("likes")
      .eq("id", videoId)
      .single();

    if (fetchError) throw fetchError;

    // ✅ PARSE TEXT → ARRAY
    let likes = [];

    try {
      likes = video.likes ? JSON.parse(video.likes) : [];
    } catch (e) {
      likes = [];
    }

    const uid = String(userId);

    if (action === "like") {

      if (!likes.includes(uid)) {
        likes.push(uid);
      }

    } else if (action === "unlike") {

      likes = likes.filter(id => id !== uid);
    }

    const likesCount = likes.length;

    // ✅ SAVE AS STRING (IMPORTANT)
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
