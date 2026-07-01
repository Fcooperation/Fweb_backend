import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// Supabase setup
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
    // LIKES (videos + replies + comment likes)
    // ==========================
    const [
      fvidLikes,
      replyLikes,
      commentLikes
    ] = await Promise.all([
      supabase.from("fvid_likes").select("id"),
      supabase.from("fvid_reply_likes").select("id"),
      supabase.from("comment_likes").select("id")
    ]);

    const total_likes =
      (fvidLikes.data?.length || 0) +
      (replyLikes.data?.length || 0) +
      (commentLikes.data?.length || 0);

    // ==========================
    // COMMENTS (comments + replies)
    // ==========================
    const [
      comments,
      commentReplies
    ] = await Promise.all([
      supabase.from("comment").select("id"),
      supabase.from("comment_replies").select("id")
    ]);

    const total_comments =
      (comments.data?.length || 0) +
      (commentReplies.data?.length || 0);

    // ==========================
    // FOLLOWS
    // ==========================
    const { data: follows } = await supabase
      .from("fvidsfollow")
      .select("followerid");

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