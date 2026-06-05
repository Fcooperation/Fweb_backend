import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function fvidLike(req, res) {

  try {

    const {
      videoId,
      userId,
      action
    } = req.body;

    if (!videoId || !userId) {
      return res.status(400).json({
        success: false,
        error: "Missing videoId or userId"
      });
    }

    // get current likes
    const {
      data: video,
      error: fetchError
    } = await supabase
      .from("fvids")
      .select("likes")
      .eq("id", videoId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    let likes = video.likes || [];

    if (action === "like") {

      if (!likes.includes(userId)) {
        likes.push(userId);
      }

    } else if (action === "unlike") {

      likes = likes.filter(
        id => id !== userId
      );

    }

    const likesCount = likes.length;

    const {
      error: updateError
    } = await supabase
      .from("fvids")
      .update({
        likes,
        likes_count: likesCount
      })
      .eq("id", videoId);

    if (updateError) {
      throw updateError;
    }

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
