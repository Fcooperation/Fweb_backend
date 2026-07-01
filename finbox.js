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
  .select(`
id,
public_id,
video_url,
thumbnail_url,
details,
hashtags,
user_id,
created_at,
likes_count,
comment_count,
share_count
`)
  .eq("user_id", userId);

    if (videosError) throw videosError;

    const videoIds = (videos || []).map(v => v.id);

    const videoMap = Object.fromEntries(
  (videos || []).map(video => [
    video.id,
    {
      ...video,
      following: true // because it's the owner's own video
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

    // Comment likes 
    const {
  data: commentLikes,
  error: commentLikesError
} = await supabase
  .from("comment_likes")
  .select(`
    user_id,
    comment_user,
    video_id,
    created_at
  `)
  .eq("comment_user", userId)
  .gt("created_at", lastLikesSync)
  .neq("user_id", userId);

if (commentLikesError) throw commentLikesError;
    
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
  .select("user_id, video_id, comment_text, created_at")
  .order("created_at", { ascending: false })
  .in("video_id", videoIds)
  .gt("created_at", lastCommentsSync)
  .neq("user_id", userId);

if (commentsError) throw commentsError;

    // ==========================
// FIND MY COMMENTS
// ==========================

const {
  data: myComments,
  error: myCommentsError
} = await supabase
  .from("comments")
  .select("id")
  .eq("user_id", userId);

if (myCommentsError) throw myCommentsError;

const myCommentIds =
  (myComments || []).map(c => c.id);

    // ==========================
// REPLIES TO MY COMMENTS
// ==========================

let commentReplies = [];

if (myCommentIds.length > 0) {

  const {
    data,
    error
  } = await supabase
    .from("comment_replies")
    .select(`
      comment_id,
      user_id,
      reply,
      reply_user_id,
      video_id,
      reply_text,
      created_at
`)
    .in("comment_id", myCommentIds)
    .gt("created_at", lastCommentsSync)
    .neq("user_id", userId);

  if (error) throw error;

  commentReplies = data || [];
}

    // ==========================
// REPLIES TO MY REPLIES
// ==========================

const {
  data: replyReplies,
  error: replyRepliesError
} = await supabase
  .from("comment_replies")
  .select(`
  user_id,
  reply,
  reply_user_id,
  reply_text,
  video_id,
  created_at
`)
  .eq("reply_user_id", userId)
  .eq("reply", true)
  .gt("created_at", lastCommentsSync);

if (replyRepliesError) throw replyRepliesError;
    
    const { data: myLikes } = await supabase
  .from("fvid_likes")
  .select("video_id")
  .eq("user_id", userId)
  .in("video_id", videoIds);

const likedSet = new Set(
  (myLikes || []).map(l => l.video_id)
);
    const latestLikes = (likes || []).slice(0, 20);

const latestComments = (comments || []).slice(0, 20);

const latestFollows = (follows || []).slice(0, 20);

const latestCommentLikes =
  (commentLikes || []).slice(0, 20);

    const latestCommentReplies =
(commentReplies || []).slice(0,20);

const latestReplyReplies =
(replyReplies || []).slice(0,20);
    
    // Get video ids from comment likes
const notificationVideoIds = [

  ...new Set([

    ...latestCommentLikes.map(l=>l.video_id),

    ...latestCommentReplies.map(r=>r.video_id),

    ...latestReplyReplies.map(r=>r.video_id)

  ])

];

    const { data: commentLikeVideos, error: commentVideoError } =
await supabase
  .from("fvids")
  .select(`
id,
public_id,
video_url,
thumbnail_url,
details,
hashtags,
user_id,
created_at,
likes_count,
comment_count,
share_count
`)
  .in("id", notificationVideoIds);

if (commentVideoError) throw commentVideoError;


    
    // ==========================
// GET USERNAMES
// ==========================

// Collect unique user IDs
const accountIds = [

...new Set([

...latestLikes.map(l=>l.user_id),

...latestComments.map(c=>c.user_id),

...latestFollows.map(f=>f.follower_id),

...latestCommentLikes.map(c=>c.user_id),

...latestCommentReplies.map(r=>r.user_id),

...latestReplyReplies.map(r=>r.user_id)

])

];

let accountMap = {};

    (commentLikeVideos || []).forEach(video => {

  videoMap[video.id] = {
    ...video,
    following: true
  };

});

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
const likesWithUsernames =
latestLikes.map(like => ({
   type: "video_like",
  ...like,
  username: accountMap[like.user_id]?.username || null,
  profile_pic: accountMap[like.user_id]?.profile_pic || null,
  video: {
  ...videoMap[like.video_id],
  liked: likedSet.has(like.video_id),
  following: true
}
}));

// Add username and profile pics to comments
const commentsWithUsernames = latestComments.map(comment => ({
  ...comment,
  username: accountMap[comment.user_id]?.username || null,
  profile_pic: accountMap[comment.user_id]?.profile_pic || null,
  video: {
  ...videoMap[comment.video_id],
  liked: likedSet.has(comment.video_id),
  following: true
  }
}));

// Add username and profile pics to follows
const followsWithUsernames = latestFollows.map(follow => ({
  ...follow,
  username: accountMap[follow.follower_id]?.username || null,
  profile_pic: accountMap[follow.follower_id]?.profile_pic || null
}));

    const newestLikeActivity = [

...(likes || []),

...(commentLikes || [])

]

.sort(

(a,b)=>

new Date(b.created_at)-

new Date(a.created_at)

);
    const newestCommentActivity = [

...(comments || []),

...(commentReplies || []),

...(replyReplies || [])

]

.sort(

(a,b)=>

new Date(b.created_at)-

new Date(a.created_at)

);


    // ==========================
// UPDATE LAST SYNC TIMES
// ==========================

const updateData = {};

if (newestLikeActivity.length > 0) {
  updateData.last_likes_sync =

newestLikeActivity[0].created_at;
}

if (newestCommentActivity.length > 0) {

updateData.last_comments_sync =

newestCommentActivity[0].created_at;

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

    const commentLikesWithUsers =
latestCommentLikes.map(like => ({
  ...like,

  type: "comment_like",

  username:
    accountMap[like.user_id]?.username || null,

  profile_pic:
    accountMap[like.user_id]?.profile_pic || null,

  video: {
    ...videoMap[like.video_id],
    liked: likedSet.has(like.video_id),
    following: true
  }
}));

    const commentRepliesWithUsers =
latestCommentReplies.map(reply => ({

  type: "comment_reply",

  reply: reply.reply,

reply_to_user_id: reply.reply_user_id,

reply_text: reply.reply_text,

video_id: reply.video_id,

created_at: reply.created_at,

  username:
  accountMap[reply.user_id]?.username || null,

profile_pic:
  accountMap[reply.user_id]?.profile_pic || null,

  video: {

    ...videoMap[reply.video_id],

    liked:
      likedSet.has(reply.video_id),

    following: true

  }

}));

    const replyRepliesWithUsers =
latestReplyReplies.map(reply => ({

  type: "reply_reply",

  ...reply,

  username:
    accountMap[reply.user_id]?.username || null,

  profile_pic:
    accountMap[reply.user_id]?.profile_pic || null,

  video: {
    ...videoMap[reply.video_id],
    liked: likedSet.has(reply.video_id),
    following: true
  }

}));

    
    const mergedLikes = [

  ...likesWithUsernames,

  ...commentLikesWithUsers

]
.sort(
(a,b)=>
new Date(b.created_at)-new Date(a.created_at)
)
.slice(0,20);
    
return {
  success: true,
  data: {
    total_likes:
mergedLikes.length,
    likes:
mergedLikes,

    comments:

[

...commentsWithUsernames,

...commentRepliesWithUsers,

...replyRepliesWithUsers

]

.sort(

(a,b)=>

new Date(b.created_at)-

new Date(a.created_at)

)

.slice(0,20),

total_comments:

commentsWithUsernames.length +

commentRepliesWithUsers.length +

replyRepliesWithUsers.length,

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