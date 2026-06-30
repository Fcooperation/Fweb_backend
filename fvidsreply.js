import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ---------------- GET REPLIES ----------------
export async function getReplies(req, res) {

  try {

    const commentId = req.query.commentId;
    const userId = req.query.userId || null;
    const page =
      parseInt(req.query.page) || 1;

    const limit =
      parseInt(req.query.limit) || 5;

    if (!commentId) {

      return res.status(400).json({
        success: false,
        error: "Missing commentId"
      });

    }

    const from =
      (page - 1) * limit;

    const to =
      from + limit - 1;

    const {

      data: replies,

      error,

      count

    } = await supabase

      .from("comment_replies")

      .select("*", {
        count: "exact"
      })

      .eq("comment_id", commentId)

      .order("created_at", {
        ascending: false
      })

      .range(from, to);

    if (error) throw error;

    const replyIds = replies.map(r => r.id);

let likedReplies = [];

if (userId && replyIds.length) {

  const {
    data: likes,
    error: likesError
  } = await supabase
    .from("fvid_reply_likes")
    .select("reply_id")
    .eq("user_id", userId)
    .in("reply_id", replyIds);

  if (likesError) throw likesError;

  likedReplies = likes.map(l => l.reply_id);
}

    const userIds = [
  ...new Set([
    ...replies.map(r => r.user_id),
    ...replies
      .filter(r => r.reply_user_id)
      .map(r => r.reply_user_id)
  ])
];

    const {

      data: users,

      error: usersError

    } = await supabase

      .from("fwebaccount")

      .select("id, username, profile_pic")

      .in("id", userIds);

    if (usersError) throw usersError;

    const userMap = {};

    users.forEach(u => {

      userMap[u.id] = u;

    });

    const formattedReplies =
      replies.map(r => ({

        
  id: r.id,

  commentId: r.comment_id,

  videoId: r.video_id,

  userId: r.user_id,

  username:
    userMap[r.user_id]?.username ||
    "Unknown",

  profile_pic:
    userMap[r.user_id]?.profile_pic ||
    null,

  text: r.reply_text,

  createdAt: r.created_at,

  reply_likes_count:
    r.reply_likes_count || 0,

  liked:
    likedReplies.includes(r.id),

  reply: r.reply,

  replyId: r.reply_id,

  replyingToUserId:
    r.reply_user_id,

  replyingToUsername:
    r.reply_user_id
      ? (
          userMap[r.reply_user_id]
            ?.username || "Unknown"
        )
      : null
      }));

    return res.status(200).json({

      success: true,

      replies: formattedReplies,

      hasMore:
        to + 1 < (count || 0)

    });

  } catch (err) {

    console.error(
      "GET REPLIES ERROR:",
      err.message
    );

    return res.status(500).json({

      success: false,

      error: err.message

    });

  }

}

// ---------------- POST REPLY ----------------
export async function postReply(req, res) {

  try {

    const {
  commentId,
  videoId,
  userId,
  replyText,
  reply = false,
  replyId = null
} = req.body;

    if (
      !commentId ||
      !videoId ||
      !userId ||
      !replyText
    ) {

      return res.status(400).json({
        success: false,
        error: "Missing required fields"
      });

    }

    let replyUserId = null;

if (reply && replyId) {

  const { data: targetReply, error } =
  await supabase
    .from("comment_replies")
    .select("user_id, comment_id")
    .eq("id", replyId)
    .single();

  if (error || !targetReply) {

    return res.status(404).json({
      success:false,
      error:"Reply not found"
    });

  }

  replyUserId = targetReply.user_id;

}

    // ---------------- INSERT REPLY ----------------

    const {

      data,

      error

    } = await supabase
      .from("comment_replies")
      .insert([
{
  comment_id: commentId,
  video_id: videoId,
  user_id: userId,
  reply_text: replyText,

  reply,
  reply_id: replyId,
  reply_user_id: replyUserId
}
])
      .select()
      .single();

    if (error) throw error;

    // ---------------- UPDATE REPLY COUNT ----------------

    const { count } = await supabase

      .from("comment_replies")

      .select("*", {

        count: "exact",

        head: true

      })

      .eq("comment_id", commentId);

    await supabase

      .from("comments")

      .update({

        comment_replies_count:
          count || 0

      })

      .eq("id", commentId);

    // ---------------- GET USER DETAILS ----------------

    const {

      data: user

    } = await supabase

      .from("fwebaccount")

      .select("username, profile_pic")

      .eq("id", userId)

      .single();

    return res.status(200).json({

      success: true,

      reply: {
  id: data.id,
  commentId,
  videoId,
  userId,

  username: user?.username || "Unknown",
  profile_pic: user?.profile_pic || null,

  text: data.reply_text,
  createdAt: data.created_at,

  reply_likes_count: 0,
  liked: false,

  reply,
  replyId,
  replyingToUserId: replyUserId
},

      repliesCount:
        count || 1

    });

  } catch (err) {

    console.error(
      "POST REPLY ERROR:",
      err.message
    );

    return res.status(500).json({

      success: false,

      error: err.message

    });

  }

}