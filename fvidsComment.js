import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

export default async function fvidsComment(req, res) {

  try {

    const {
      videoId,
      videoUrl,
      userId,
      commentText
    } = req.body;

    if (
      !videoId ||
      !videoUrl ||
      !userId ||
      !commentText
    ) {
      return res.status(400).json({
        error: "Missing required fields"
      });
    }

    const { data, error } =
      await supabase
        .from("comments")
        .insert([
          {
            video_id: videoId,
            video_url: videoUrl,
            user_id: userId,
            comment_text: commentText
          }
        ])
        .select();

    if (error) {
      console.error(error);

      return res.status(500).json({
        error: error.message
      });
    }

    const { count } = await supabase
  .from("comments")
  .select("*", {
    count: "exact",
    head: true
  })
  .eq("video_id", videoId);

await supabase
  .from("fvids")
  .update({
    comment_count: count || 0
  })
  .eq("id", videoId);

    return res.status(200).json({
      success: true,
      comment: data[0]
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      error: "Server error"
    });
  }
  }
