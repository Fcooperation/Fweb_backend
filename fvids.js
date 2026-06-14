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

  // ---------------- YOUR ORIGINAL LOGIC ----------------
  const unliked = safeData.filter(v => !v.liked);
  const liked = safeData.filter(v => v.liked);

  shuffle(unliked);
  shuffle(liked);

  return [...unliked, ...liked];
}


// ---------------- GET SINGLE VIDEO ----------------
export async function getSingleVideo(publicId) {

  if (!publicId) {
    throw new Error("No video id provided");
  }

  const { data, error } = await supabase
    .from("fvids")
    .select("*")
    .eq("public_id", publicId)
    .single();

  if (error) throw new Error(error.message);

  let likesArray = [];

  try {
    likesArray = data.likes ? JSON.parse(data.likes) : [];
  } catch {
    likesArray = [];
  }

  return {
    ...data,
    likes: undefined,
    liked: false,
    likes_count: likesArray.length,
    comment_count: data.comment_count || 0
  };
    }
