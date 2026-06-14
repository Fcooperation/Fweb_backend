import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function fvidShare(body) {
  const { publicId, type } = body;

  if (!publicId) throw new Error("No publicId");

  const { data, error } = await supabase
    .from("fvids")
    .select("share_count")
    .eq("public_id", publicId)
    .single();

  if (error) throw error;

  const newCount = (data.share_count || 0) + 1;

  const { error: updateError } = await supabase
    .from("fvids")
    .update({ share_count: newCount })
    .eq("public_id", publicId);

  if (updateError) throw updateError;

  return {
    success: true,
    share_count: newCount,
    type
  };
    }
