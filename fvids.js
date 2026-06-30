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

  let likedMap = {};

if (userId) {

  const videoIds =
    data.map(v => v.id);

  const { data: likes } =
    await supabase
      .from("fvid_likes")
      .select("video_id")
      .eq("liker_id", String(userId))
      .in("video_id", videoIds);

  likedMap = Object.fromEntries(
    (likes || []).map(row => [
      String(row.video_id),
      true
    ])
  );

}

  const safeData = data.map(video => {

    

    const uid = userId
      ? String(userId)
      : null;

    return {
      ...video,

      user:
  usersMap[String(video.user_id)] || null,

username:
  usersMap[String(video.user_id)]?.username || null,

profile_pic:
  usersMap[String(video.user_id)]?.profile_pic || null,

      likes: undefined,

      liked: uid
  ? Boolean(likedMap[String(video.id)])
  : false,

      following: uid
  ? Boolean(
      followingMap[
        String(video.user_id)
      ]
    )
  : false,

      likes_count: video.likes_count || 0,,

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

  const { data, error } =
  await supabase
    .from("fvids")
    .select("*")
    .eq("public_id", publicId)
    .single();

if (error) {
  throw new Error(error.message);
}

  let liked = false;

if (userId) {

  const { data: like } =
    await supabase
      .from("fvid_likes")
      .select("id")
      .eq("video_id", data.id)
      .eq("liker_id", String(userId))
      .maybeSingle();

  liked = !!like;

}

const uid = userId
  ? String(userId)
  : null;

// ---------------- FETCH USER + FOLLOW STATUS ----------------

let user = null;
let following = false;

const promises = [];

// Fetch owner
if (data.user_id) {

  promises.push(

    supabase
      .from("fwebaccount")
      .select("id, username, profile_pic")
      .eq("id", data.user_id)
      .single()

  );

} else {

  promises.push(Promise.resolve({ data: null }));

}

// Fetch follow status
if (userId && data.user_id) {

  promises.push(

    supabase
      .from("fvidsfollow")
      .select("id")
      .eq("follower_id", String(userId))
      .eq("following_id", String(data.user_id))
      .maybeSingle()

  );

}

const responses = await Promise.all(promises);

user = responses[0]?.data || null;

if (responses.length > 1) {
  following = !!responses[1]?.data;
}

  return {
  ...data,

  user,

  // Convenience fields
  username: user?.username || null,
  profile_pic: user?.profile_pic || null,

  // Hide raw likes array
  likes: undefined,

  liked,

  following,
    
likes_count: data.likes_count || 0,

  comment_count:
    data.comment_count || 0,

  views_count:
    data.views_count || 0
};
  }