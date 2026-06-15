import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ---------------- FETCH FEED VIDEOS ----------------
export async function fetchVideos(userId = null, page = 1, limit = 20) {

  const start = (page - 1) * limit;
  const end = start + limit - 1;

  const { data, error } = await supabase
    .from("fvids")
    .select("*")
    .range(start, end);

  if (error) throw new Error(error.message);

  const safeData = data.map(video => {

    let likesArray = [];

    try {
      likesArray = video.likes ? JSON.parse(video.likes) : [];
    } catch {
      likesArray = [];
    }

    const uid = userId ? String(userId) : null;

    return {
      ...video,
      likes: undefined,
      liked: uid ? likesArray.includes(uid) : false,
      likes_count: likesArray.length,
      comment_count: video.comment_count || 0
    };
  });

  // ---------------- SHUFFLE ----------------
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ---------------- UNLIKED FIRST (YOUR LOGIC) ----------------
  const unliked = safeData.filter(v => !v.liked);
  const liked = safeData.filter(v => v.liked);

  shuffle(unliked);
  shuffle(liked);

  return [...unliked, ...liked];
}


// ---------------- GET SINGLE VIDEO ----------------
export async function getSingleVideo(publicId, page = 1, limit = 20) {

  if (!publicId) {
    throw new Error("No video id provided");
  }

  // 1. ALWAYS fetch the target video directly (safe lookup)
  const { data: targetData, error: targetError } = await supabase
    .from("fvids")
    .select("*")
    .eq("public_id", publicId)
    .single();

  if (targetError && targetError.code !== "PGRST116") {
    throw new Error(targetError.message);
  }

  let targetVideo = targetData || null;

  // 2. fetch random feed videos
  const start = (page - 1) * limit;
  const end = start + limit - 1;

  const { data, error } = await supabase
    .from("fvids")
    .select("*")
    .range(start, end);

  if (error) throw new Error(error.message);

  // 3. format helper
  function format(video) {
    let likesArray = [];

    try {
      likesArray = video.likes ? JSON.parse(video.likes) : [];
    } catch {
      likesArray = [];
    }

    return {
      ...video,
      likes: undefined,
      liked: false,
      likes_count: likesArray.length,
      comment_count: video.comment_count || 0
    };
  }

  const formattedFeed = data.map(format);

  // 4. remove duplicate if target exists inside feed
  const filteredFeed = formattedFeed.filter(
    v => v.public_id !== publicId
  );

  // 5. build final result
  const result = [];

  if (targetVideo) {
    result.push(format(targetVideo));
  }

  result.push(...filteredFeed);

  return result;
}