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

    // ✅ convert TEXT → ARRAY safely
    let likesArray = [];

    try {
      likesArray = video.likes
        ? JSON.parse(video.likes)
        : [];
    } catch (e) {
      likesArray = [];
    }

    const uid = userId ? String(userId) : null;

    return {
      ...video,

      // ❌ remove raw DB field
      likes: undefined,

      // ✅ correct liked check
      liked: uid
        ? likesArray.includes(uid)
        : false,

      // ✅ always trust parsed array
      likes_count: likesArray.length
    };
  });

  return safeData;
}
