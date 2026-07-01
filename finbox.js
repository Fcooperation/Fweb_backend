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
  .select("last_likes_sync, last_comments_sync, last_follows_sync")
  .eq("user_id", userId)
  .single();

const lastLikesSync =
  state?.last_likes_sync || "1970-01-01T00:00:00Z";

const lastFollowsSync =
  state?.last_follows_sync || "1970-01-01T00:00:00Z";

    const lastCommentsSync =
  state?.last_comments_sync || "1970-01-01T00:00:00Z";

    // ==========================
    // 2. GET USER'S VIDEOS
    // ==========================
    const { data: videos, error: videosError } = await supabase
  .from("fvids")
  .select("id, public_id, thumbnail_url")
  .eq("user_id", userId);

    if (videosError) throw videosError;

    const videoIds = (videos || []).map(v => v.id);

    const videoMap = Object.fromEntries(
  (videos || []).map(video => [
    video.id,
    {
      public_id: video.public_id,
      thumbnail_url: video.thumbnail_url
    }
  ])
);

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
  .select("user_id, video_id, created_at")
  .order("created_at", { ascending: false })
  .in("video_id", videoIds)
  .gt("created_at", lastLikesSync)
  .neq("user_id", userId);

    if (likesError) throw likesError;

    // Find followers
    const { data: follows, error: followsError } = await supabase
  .from("fvidsfollow")
  .select("follower_id, following_id, created_at")
  .order("created_at", { ascending: false })
  .eq("following_id", userId)
  .gt("created_at", lastFollowsSync);

if (followsError) throw followsError;

    // Find Total Comment 
    const { data: comments, error: commentsError } = await supabase
  .from("comments")
  .select("user_id, video_id, created_at")
  .order("created_at", { ascending: false })
  .in("video_id", videoIds)
  .gt("created_at", lastCommentsSync)
  .neq("user_id", userId);

if (commentsError) throw commentsError;

    // ==========================
// GET USERNAMES
// ==========================

// Collect unique user IDs
const accountIds = [
  ...new Set([
    ...likes.map(l => l.user_id),
    ...comments.map(c => c.user_id),
    ...follows.map(f => f.follower_id)
  ])
];

let accountMap = {};

if (accountIds.length > 0) {

  const { data: accounts, error: accountError } = await supabase
    .from("fwebaccount")
    .select("id, username, profile_pic")
    .in("id", accountIds);

  if (accountError) throw accountError;

  accountMap = Object.fromEntries(
    accounts.map(acc => [acc.id, acc])
  );
}

// Add username and profile pic to likes
const likesWithUsernames = likes.map(like => ({
  ...like,
  username: accountMap[like.user_id]?.username || null,
  profile_pic: accountMap[like.user_id]?.profile_pic || null,
  public_id: videoMap[like.video_id]?.public_id || null,
  thumbnail_url: videoMap[like.video_id]?.thumbnail_url || null
}));

// Add username and profile pics to comments
const commentsWithUsernames = comments.map(comment => ({
  ...comment,
  username: accountMap[comment.user_id]?.username || null,
  profile_pic: accountMap[comment.user_id]?.profile_pic || null,
  public_id: videoMap[comment.video_id]?.public_id || null,
  thumbnail_url: videoMap[comment.video_id]?.thumbnail_url || null
}));

// Add username and profile pics to follows
const followsWithUsernames = follows.map(follow => ({
  ...follow,
  username: accountMap[follow.follower_id]?.username || null,
  profile_pic: accountMap[follow.follower_id]?.profile_pic || null
}));

    // ==========================
// UPDATE LAST SYNC TIMES
// ==========================

const updateData = {};

if (likes.length > 0) {
  updateData.last_likes_sync = likes[0].created_at;
}

if (comments.length > 0) {
  updateData.last_comments_sync = comments[0].created_at;
}

if (follows.length > 0) {
  updateData.last_follows_sync = follows[0].created_at;
}

if (Object.keys(updateData).length > 0) {

  updateData.user_id = userId;

  const { error: syncError } = await supabase
    .from("fvid_inbox_state")
    .upsert(updateData, {
      onConflict: "user_id"
    });

  if (syncError) throw syncError;

}
    
return {
  success: true,
  data: {
    total_likes: likesWithUsernames.length,
    likes: likesWithUsernames,

    total_comments: commentsWithUsernames.length,
    comments: commentsWithUsernames,

    total_follow: followsWithUsernames.length,
    follows: followsWithUsernames
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