import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function fvidShare(body) {
  const {
  publicId,
  userId = null,
  type
} = body;

  if (!publicId) {
    throw new Error("No publicId");
  }

  const { data, error } = await supabase
  .from("fvids")
  .select("share_count, category")
  .eq("public_id", publicId)
  .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(`Video not found: ${publicId}`);
  }

  const newCount = (data.share_count || 0) + 1;

  const { error: updateError } = await supabase
    .from("fvids")
    .update({ share_count: newCount })
    .eq("public_id", publicId);

  if (updateError) {
    throw updateError;
  }

  // ---------------- UPDATE USER CATEGORY SCORE ----------------

if (userId) {

  const {
    data: categoryRow,
    error: categoryError
  } = await supabase
    .from("user_category_scores")
    .select("score")
    .eq("user_id", userId)
    .eq("category", data.category)
    .maybeSingle();

  if (categoryError) {
    throw categoryError;
  }

  if (categoryRow) {

    const {
      error: scoreError
    } = await supabase
      .from("user_category_scores")
      .update({
        score: Number(categoryRow.score) + 15,
        last_updated: new Date().toISOString()
      })
      .eq("user_id", userId)
      .eq("category", data.category);

    if (scoreError) {
      throw scoreError;
    }

  }

}

  return {
    success: true,
    share_count: newCount,
    type
  };
}