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

    // ---------------- GET VIDEO ----------------

    const { data: video, error: fetchError } =
      await supabase
        .from("fvids")
        .select("likes,user_id")
        .eq("id", videoId)
        .single();

    if (fetchError) throw fetchError;

    const ownerId = video.user_id;

    // ---------------- PARSE LIKES ----------------

    let likes = [];

    try {
      likes = video.likes
        ? JSON.parse(video.likes)
        : [];
    } catch {
      likes = [];
    }

    const uid = String(userId);

    // ---------------- LIKE ----------------

    if (action === "like") {

      if (!likes.includes(uid)) {

        likes.push(uid);

        // Save notification/history
        const {
  error: likeInsertError
} = await supabase
  .from("fvid_likes")
  .upsert(
    {
      video_id: videoId,
      owner_id: ownerId,
      liker_id: uid
    },
    {
      onConflict: "video_id,liker_id"
    }
  );

if (likeInsertError) {
  console.error(
    "fvid_likes insert failed:",
    likeInsertError
  );

  throw likeInsertError;
}

      }

    }

    // ---------------- UNLIKE ----------------

    else if (action === "unlike") {

      likes = likes.filter(id => id !== uid);

      const {
  error: unlikeError
} = await supabase
  .from("fvid_likes")
  .delete()
  .eq("video_id", videoId)
  .eq("liker_id", uid);

if (unlikeError) {
  console.error(
    "fvid_likes delete failed:",
    unlikeError
  );

  throw unlikeError;
}
    }

    // ---------------- UPDATE VIDEO ----------------

    const likesCount = likes.length;

    const { error: updateError } =
      await supabase
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

  }

  catch (err) {

    console.error(err);

    return res.status(500).json({
      success: false,
      error: err.message
    });

  }

      }