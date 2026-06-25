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

  // ---------------- FETCH MATCHING USERS ----------------

  const userIds = [
    ...new Set(
      data
        .map(v => v.user_id)
        .filter(Boolean)
    )
  ];

  let usersMap = {};

  if (userIds.length) {

    const { data: users, error: usersError } =
  await supabase
    .from("fwebaccount")
    .select("id, username, profile_pic")
    .in("id", userIds);

    if (usersError) {
      throw new Error(usersError.message);
    }

    usersMap = Object.fromEntries(
      users.map(user => [String(user.id), user])
    );
  }

  let followingMap = {};

if (userId) {

  const { data: follows } =
    await supabase
      .from("fvidsfollow")
      .select("following_id")
      .eq("follower_id", String(userId));

  followingMap = Object.fromEntries(
    (follows || []).map(row => [
      String(row.following_id),
      true
    ])
  );
}

  const safeData = data.map(video => {

    let likesArray = [];

    try {
      likesArray = video.likes
        ? JSON.parse(video.likes)
        : [];
    } catch {
      likesArray = [];
    }

    const uid = userId
      ? String(userId)
      : null;

    return {
      ...video,

      user:
        usersMap[String(video.user_id)] || null,

      likes: undefined,

      liked: uid
        ? likesArray.includes(uid)
        : false,

      following: uid
  ? Boolean(
      followingMap[
        String(video.user_id)
      ]
    )
  : false,

      likes_count: likesArray.length,

      comment_count:
        video.comment_count || 0
    };
  });

  // ---------------- SHUFFLE ----------------

  function shuffle(arr) {
    for (
      let i = arr.length - 1;
      i > 0;
      i--
    ) {
      const j = Math.floor(
        Math.random() * (i + 1)
      );

      [arr[i], arr[j]] =
      [arr[j], arr[i]];
    }

    return arr;
  }

  // ---------------- UNLIKED FIRST ----------------

  const unliked =
    safeData.filter(v => !v.liked);

  const liked =
    safeData.filter(v => v.liked);

  shuffle(unliked);
  shuffle(liked);

  return [...unliked, ...liked];
}


// ---------------- GET SINGLE VIDEO ----------------

export async function getSingleVideo(
  publicId,
  userId = null
) {

  if (!publicId) {
    throw new Error(
      "No video id provided"
    );
  }

  const {
  data: account
} = await supabase
  .from("fwebaccount")
  .select("id, username, profile_pic")
  .eq("id", data.user_id)
  .single();

  if (error) {
    throw new Error(error.message);
  }

  let likesArray = [];

try {
  likesArray = data.likes
    ? JSON.parse(data.likes)
    : [];
} catch {
  likesArray = [];
}

const uid = userId
  ? String(userId)
  : null;

  // ---------------- FETCH VIDEO OWNER ----------------

  let user = null;

  if (data.user_id) {

    const {
      data: account
    } = await supabase
      .from("fwebaccount")
      .select("*")
      .eq("id", data.user_id)
      .single();

    user = account || null;
  }

  let following = false;

if (userId && data.user_id) {

  const { data: followRow } =
    await supabase
      .from("fvidsfollow")
      .select("id")
      .eq("follower_id", String(userId))
      .eq("following_id", String(data.user_id))
      .maybeSingle();

  following = !!followRow;
}

  return {
  ...data,

  user,

  likes: undefined,

  liked: uid
    ? likesArray.includes(uid)
    : false,

  following,

  likes_count:
    likesArray.length,

  comment_count:
    data.comment_count || 0
};
  }