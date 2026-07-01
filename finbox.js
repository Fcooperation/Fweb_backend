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
  .select("last_likes_sync, last_follows_sync")
  .eq("user_id", userId)
  .single();

const lastLikesSync =
  state?.last_likes_sync || "1970-01-01T00:00:00Z";

const lastFollowsSync =
  state?.last_follows_sync || "1970-01-01T00:00:00Z";

    // ==========================
    // 2. GET USER'S VIDEOS
    // ==========================
    const { data: videos, error: videosError } = await supabase
      .from("fvids")
      .select("id")
      .eq("user_id", userId)
      .gt("created_at", lastLikesSync);

    if (videosError) throw videosError;

    const videoIds = (videos || []).map(v => v.id);

    if (videoIds.length === 0) {
      return {
        success: true,
        data: {
          total_likes: 0
        }
      };
    }

    // ==========================
    // 3. FIND LIKES FOR THOSE VIDEOS
    // ==========================
    const { data: likes, error: likesError } = await supabase
      .from("fvid_likes")
      .select("user_id, video_id")
      .in("video_id", videoIds);

    if (likesError) throw likesError;

    // Find followers
    const { data: follows, error: followsError } = await supabase
  .from("fvidsfollow")
  .select("follower_id, following_id, created_at")
  .eq("following_id", userId)
  .gt("created_at", lastFollowsSync);

if (followsError) throw followsError;

return {
  success: true,
  data: {
    total_likes: likes.length,
    likes,

    total_follow: follows.length,
    follows
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