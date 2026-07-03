import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// ---------------- SUPABASE INIT ----------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ---------------- POST COMMENT ----------------
export async function postComment(req, res) {
  try {
    const {
      videoId,
      videoUrl,
      userId,
      commentText
    } = req.body;

    if (!videoId || !videoUrl || !userId || !commentText) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields"
      });
    }

    // insert comment
    const { data, error } = await supabase
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

    if (error) throw error;

// ---------------- GET VIDEO CATEGORY ----------------

const {
  data: video,
  error: videoError
} = await supabase
  .from("fvids")
  .select("category")
  .eq("id", videoId)
  .single();

if (videoError) {
  throw videoError;
}

    // ---------------- UPDATE CATEGORY SCORE ----------------

const {
  data: existingCategory
} = await supabase
  .from("user_category_scores")
  .select("score")
  .eq("user_id", userId)
  .eq("category", video.category)
  .maybeSingle();

if (existingCategory) {

  // Category already exists
  await supabase
    .from("user_category_scores")
    .update({
      score: Number(existingCategory.score) + 20,
      last_updated: new Date().toISOString()
    })
    .eq("user_id", userId)
    .eq("category", video.category);

} else {

  // First interaction with this category
  await supabase
    .from("user_category_scores")
    .insert({
      user_id: userId,
      category: video.category,
      score: 20,
      videos_watched: 0,
      last_updated: new Date().toISOString()
    });

}


    // update comment count
    const { count } = await supabase
      .from("comments")
      .select("*", { count: "exact", head: true })
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
    console.error("POST COMMENT ERROR:", err.message);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

  // ---------------- GET COMMENTS (PAGINATED) ----------------
export async function getComments(req, res) {
  try {

    const {
  videoId,
  userId,
  page = 1,
  limit = 20
} = req.query;

    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: "videoId is required"
      });
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);

    const start = (pageNum - 1) * limitNum;
    const end = start + limitNum - 1;

    // ---------------- GET VIDEO OWNER ----------------
    const { data: videoData, error: videoError } =
      await supabase
        .from("fvids")
        .select("user_id, created_at")
        .eq("id", videoId)
        .single();

    if (videoError) throw videoError;

    const creatorId =
      videoData?.user_id || null;

    const videoCreatedAt =
      videoData?.created_at || null;

    // ---------------- FETCH COMMENTS ----------------
    const { data: comments, error } =
      await supabase
        .from("comments")
        .select("*")
        .eq("video_id", videoId)
        .order("created_at", {
          ascending: false
        })
        .range(start, end);

    // ---------------- GET COMMENT LIKES ----------------
const commentIds = comments.map(c => c.id);

const { data: likes } = await supabase
  .from("comment_likes")
  .select("comment_id, user_id")
  .in("comment_id", commentIds);

const likesMap = {};

(likes || []).forEach(like => {

  if (!likesMap[like.comment_id]) {
    likesMap[like.comment_id] = [];
  }

  likesMap[like.comment_id].push(like.user_id);

});

    if (error) throw error;

    if (!comments || comments.length === 0) {
      return res.json({
        success: true,
        comments: [],
        hasMore: false
      });
    }

    // ---------------- GET USER IDS ----------------
    const userIds = [
      ...new Set(
        comments.map(c => c.user_id)
      )
    ];

    const { data: users } = await supabase
  .from("fwebaccount")
  .select("id, username, profile_pic")
  .in("id", userIds);

const userMap = {};

(users || []).forEach(u => {
  userMap[u.id] = {
    username: u.username,
    profile_pic: u.profile_pic || null
  };
});


    // ---------------- ENRICH COMMENTS ----------------
    const enriched = comments.map(c => {

  const likedUsers =
    likesMap[c.id] || [];

  return {

    id: c.id,

    text: c.comment_text,

    userId: c.user_id,

    username:
      userMap[c.user_id]?.username ||
      "Unknown",

    profile_pic:
      userMap[c.user_id]?.profile_pic ||
      null,

    creatorId,

    createdAt: c.created_at,

    videoCreatedAt,

    comment_likes_count:
      likedUsers.length,

    comment_replies_count:
      c.comment_replies_count || 0,

    liked:
      likedUsers.includes(userId)

  };

});


    return res.json({
      success: true,
      comments: enriched,
      hasMore:
        comments.length === limitNum
    });

  } catch (err) {

    console.error(
      "GET COMMENTS ERROR:",
      err.message
    );

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}