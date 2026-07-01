import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function fInbox(body) {

  console.log("📬 Inbox request received:", body);

  const { userId, type } = body;

  if (!userId) {
    return {
      success: false,
      error: "Missing userId"
    };
  }

  if (type !== "main") {
    return {
      success: false,
      error: "Invalid type"
    };
  }

  try {

    // ==========================
    // 1. GET LAST SYNC STATE
    // ==========================
    const { data: state } = await supabase
      .from("fvid_inbox_state")
      .select("*")
      .eq("user_id", userId)
      .single();

    const lastLikesSync = state?.last_likes_sync || "1970-01-01";
    const lastCommentsSync = state?.last_comments_sync || "1970-01-01";
    const lastFollowsSync = state?.last_follows_sync || "1970-01-01";

    // ==========================
    // 2. NEW LIKES (ONLY USER RELATED)
    // ==========================
    const { data: fvidLikes } = await supabase
      .from("fvid_likes")
      .select("id")
      .eq("user_id", userId)
      .gt("created_at", lastLikesSync);

    const { data: replyLikes } = await supabase
      .from("fvid_reply_likes")
      .select("id")
      .eq("user_id", userId)
      .gt("created_at", lastLikesSync);

    const { data: commentLikes } = await supabase
      .from("comment_likes")
      .select("id")
      .eq("user_id", userId)
      .gt("created_at", lastLikesSync);

    const total_likes =
      (fvidLikes?.length || 0) +
      (replyLikes?.length || 0) +
      (commentLikes?.length || 0);

    // ==========================
    // 3. NEW COMMENTS
    // ==========================
    const { data: comments } = await supabase
      .from("comment")
      .select("id")
      .eq("user_id", userId)
      .gt("created_at", lastCommentsSync);

    const { data: commentReplies } = await supabase
      .from("comment_replies")
      .select("id")
      .eq("user_id", userId)
      .gt("created_at", lastCommentsSync);

    const total_comments =
      (comments?.length || 0) +
      (commentReplies?.length || 0);

    // ==========================
    // 4. NEW FOLLOWS
    // ==========================
    const { data: follows } = await supabase
      .from("fvidsfollow")
      .select("followerid")
      .eq("user_id", userId)
      .gt("created_at", lastFollowsSync);

    const total_follow = follows?.length || 0;

    // ==========================
    // RESPONSE
    // ==========================
    return {
      success: true,
      data: {
        total_likes,
        total_comments,
        total_follow
      }
    };

  } catch (err) {

    console.error("❌ Inbox error:", err);

    return {
      success: false,
      error: err.message
    };
  }
}