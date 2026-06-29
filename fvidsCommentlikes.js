import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

export default async function fvidsCommentLikes(body) {

  const {
    videoId,
    commentId,
    commentUser,
    userId
  } = body;

  if (
    !videoId ||
    !commentId ||
    !commentUser ||
    !userId
  ) {

    throw new Error(
      "Missing required fields"
    );

  }

  // ---------------- CHECK IF ALREADY LIKED ----------------

  const {
    data: existing,
    error: existingError
  } = await supabase
    .from("comment_likes")
    .select("id")
    .eq("comment_id", commentId)
    .eq("user_id", String(userId))
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  let liked = false;

  // ---------------- UNLIKE ----------------

  if (existing) {

    const { error } = await supabase
      .from("comment_likes")
      .delete()
      .eq("id", existing.id);

    if (error) throw error;

  }

  // ---------------- LIKE ----------------

  else {

    const { error } = await supabase
      .from("comment_likes")
      .insert([
        {
          video_id: videoId,
          comment_id: commentId,
          comment_user: commentUser,
          user_id: String(userId)
        }
      ]);

    if (error) throw error;

    liked = true;

  }

  // ---------------- UPDATE LIKE COUNT ----------------

  const {
    count,
    error: countError
  } = await supabase
    .from("comment_likes")
    .select("*", {
      count: "exact",
      head: true
    })
    .eq("comment_id", commentId);

  if (countError) {
    throw countError;
  }

  const { error: updateError } =
    await supabase
      .from("comments")
      .update({
        comment_likes_count:
          count || 0
      })
      .eq("id", commentId);

  if (updateError) {
    throw updateError;
  }

  return {

    success: true,

    liked,

    likesCount:
      count || 0

  };

}