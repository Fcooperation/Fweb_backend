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


// ---------------- GET SINGLE VIDEO + FEED + SHARE UPDATE ----------------
export async function getSingleVideo(publicId) {

  if (!publicId) {
    throw new Error("No video id provided");
  }

  // 1. GET THE SINGLE VIDEO FIRST
  const { data: singleVideo, error: singleError } = await supabase
    .from("fvids")
    .select("*")
    .eq("public_id", publicId)
    .single();

  if (singleError) throw new Error(singleError.message);

  // ---------------- INCREMENT SHARE COUNT ----------------
  await supabase
    .from("fvids")
    .update({
      share_count: (singleVideo.share_count || 0) + 1
    })
    .eq("public_id", publicId);

  // 2. GET FEED (20 VIDEOS)
  const { data: feedData, error: feedError } = await supabase
    .from("fvids")
    .select("*")
    .limit(20);

  if (feedError) throw new Error(feedError.message);

  const safeFeed = feedData.map(video => {

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
  });

  // 3. PUT SELECTED VIDEO FIRST
  const filteredFeed = safeFeed.filter(v => v.public_id !== publicId);

  const finalFeed = [
    {
      ...singleVideo,
      likes: undefined,
      liked: false,
      likes_count: (() => {
        try {
          return singleVideo.likes
            ? JSON.parse(singleVideo.likes).length
            : 0;
        } catch {
          return 0;
        }
      })(),
      comment_count: singleVideo.comment_count || 0
    },
    ...filteredFeed
  ];

  return finalFeed;
  }
