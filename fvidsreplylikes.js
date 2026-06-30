import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function fvidsReplyLikes(data) {

  const {
    replyId,
    userId
  } = data;

  if (!replyId || !userId) {
    throw new Error("Missing replyId or userId");
  }

  // Check if already liked
  const { data: existing, error: checkError } =
    await supabase
      .from("fvid_reply_likes")
      .select("id")
      .eq("reply_id", replyId)
      .eq("user_id", userId)
      .maybeSingle();

  if (checkError) {
    throw checkError;
  }

  let liked;

  if (existing) {

    // Unlike
    const { error } =
      await supabase
        .from("fvid_reply_likes")
        .delete()
        .eq("id", existing.id);

    if (error) throw error;

    await supabase.rpc(
      "decrement_reply_likes",
      {
        reply_id_input: replyId
      }
    );

    liked = false;

  } else {

    // Like
    const { error } =
      await supabase
        .from("fvid_reply_likes")
        .insert({
          reply_id: replyId,
          user_id: userId
        });

    if (error) throw error;

    await supabase.rpc(
      "increment_reply_likes",
      {
        reply_id_input: replyId
      }
    );

    liked = true;
  }

  // Get latest count
  const { data: reply, error } =
    await supabase
      .from("comment_replies")
      .select("reply_likes_count")
      .eq("id", replyId)
      .single();

  if (error) throw error;

  return {
    success: true,
    liked,
    likes: reply.reply_likes_count
  };

}