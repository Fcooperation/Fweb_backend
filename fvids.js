import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export async function fetchVideos(userId = null) {

  const { data, error } = await supabase
    .from("fvids")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const safeData = data.map(video => {

    const likesArray = video.likes || [];

    return {
      ...video,

      // ❌ remove raw likes array
      likes: undefined,

      // optional computed field
      liked: userId
        ? likesArray.includes(userId)
        : false,

      likes_count: video.likes_count || likesArray.length
    };
  });

  return safeData;
}
