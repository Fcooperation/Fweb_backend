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
        .select("likes,user_id,category")
        .eq("id", videoId)
        .single();

    if (fetchError) throw fetchError;

    const category = video.category;

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
    user_id: uid
  },
  {
    onConflict: "video_id,user_id"
  }
);

if (likeInsertError) {
  console.error(
    "fvid_likes insert failed:",
    likeInsertError
  );

  throw likeInsertError;
}

        // ---------------- UPDATE CATEGORY SCORE ----------------

const {
  data: existingCategory
} = await supabase
  .from("user_category_scores")
  .select("score")
  .eq("user_id", uid)
  .eq("category", category)
  .maybeSingle();

if (existingCategory) {

  // Category already exists
  await supabase
    .from("user_category_scores")
    .update({
      score: Number(existingCategory.score) + 25,
      last_updated: new Date().toISOString()
    })
    .eq("user_id", uid)
    .eq("category", category);

} else {

  // User has never interacted with this category
  await supabase
    .from("user_category_scores")
    .insert({
      user_id: uid,
      category,
      score: 25,
      videos_watched: 0,
      last_updated: new Date().toISOString()
    });

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
  .eq("user_id", uid);

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

    const {
  data: updatedRows,
  error: updateError
} = await supabase
  .from("fvids")
  .update({
    likes: JSON.stringify(likes),
    likes_count: likesCount
  })
  .eq("id", videoId)
  .select();

console.log("UPDATE RESULT:", updatedRows);

if (updateError) {
  console.error(updateError);
  throw updateError;
}

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