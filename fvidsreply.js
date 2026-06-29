import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ---------------- POST REPLY ----------------
export async function postReply(req, res) {

  try {

    const {

      commentId,

      videoId,

      userId,

      replyText

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

          reply_text: replyText

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

        comment_replies_count: count || 0

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

        username:
          user?.username || "Unknown",

        profile_pic:
          user?.profile_pic || null,

        text: data.reply_text,

        createdAt: data.created_at,

        reply_likes_count: 0,

        liked: false

      },

      repliesCount:
        count || 1

    });

  }

  catch (err) {

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