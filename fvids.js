import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ---------------- FETCH FEED VIDEOS ----------------
export async function fetchVideos(
  userId = null,
  category = null,
  page = 1,
  limit = 20
) {

// ---------------- FIRST TIME CATEGORY CHECK ----------------

if (userId) {

  const { data: categoryRows, error: categoryError } =
    await supabase
      .from("user_category_scores")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

  if (categoryError) {
    throw new Error(categoryError.message);
  }

  if (!categoryRows || categoryRows.length === 0) {
    return {
      category: false
    };
  }

}

  let data = [];

  // ---------------- GET VIEWED VIDEOS ----------------

let viewedIds = [];

if (userId) {

  const { data: viewed } = await supabase
    .from("fvid_views")
    .select("video_public_id")
    .eq("user_id", String(userId));

  viewedIds = (viewed || []).map(v => v.video_public_id);

}

  // ---------------- GET CATEGORY SCORES ----------------

let categoryScores = [];

if (userId) {

  const { data: scores, error } = await supabase
    .from("user_category_scores")
    .select("category, score")
    .eq("user_id", String(userId))
    .order("score", {
      ascending: false
    });

  if (error) {
    throw new Error(error.message);
  }

  categoryScores = scores || [];

}
  // ---------------- DUPLICATE TRACKER ----------------

const usedVideos = new Set();

  // ---------------- CATEGORY VIDEOS ----------------

for (const row of categoryScores) {

  if (data.length >= 16) break;

  const { data: vids, error } = await supabase
    .from("fvids")
    .select("*")
    .eq("category", row.category)
    .order("created_at", {
      ascending: false
    })
    .limit(30);

  if (error) {
    throw new Error(error.message);
  }

  if (!vids) continue;

  const unviewed = [];
  const viewed = [];

  for (const video of vids) {

    if (usedVideos.has(video.public_id)) {
      continue;
    }

    if (viewedIds.includes(video.public_id)) {
      viewed.push(video);
    } else {
      unviewed.push(video);
    }

  }

  const ordered = [...unviewed, ...viewed];

  for (const video of ordered) {

    if (data.length >= 16) break;

    usedVideos.add(video.public_id);

    data.push(video);

  }

}

  // ---------------- FOLLOWING VIDEOS ----------------

if (userId && data.length < 20) {

  const { data: follows } = await supabase
    .from("fvidsfollow")
    .select("following_id")
    .eq("follower_id", String(userId));

  const followingIds =
    (follows || []).map(f => f.following_id);

  if (followingIds.length) {

    const { data: followVideos, error } =
      await supabase
        .from("fvids")
        .select("*")
        .in("user_id", followingIds)
        .order("created_at", {
          ascending: false
        })
        .limit(100);

    if (error) {
      throw new Error(error.message);
    }

    const unviewed = [];
    const viewed = [];

    for (const video of followVideos || []) {

      if (usedVideos.has(video.public_id)) {
        continue;
      }

      if (viewedIds.includes(video.public_id)) {
        viewed.push(video);
      } else {
        unviewed.push(video);
      }

    }

    const ordered = [
      ...unviewed,
      ...viewed
    ];

    let added = 0;

    for (const video of ordered) {

      if (added >= 4) {
        break;
      }

      if (data.length >= 20) {
        break;
      }

      usedVideos.add(video.public_id);

      data.push(video);

      added++;

    }

  }

}

  // ---------------- EXPLORE VIDEOS ----------------

if (data.length < 20) {

  const { data: explore, error } =
    await supabase
      .from("fvids")
      .select("*")
      .order("created_at", {
        ascending: false
      })
      .limit(300);

  if (error) {
    throw new Error(error.message);
  }

  const remaining = [];

  for (const video of explore || []) {

    if (usedVideos.has(video.public_id)) {
      continue;
    }

    remaining.push(video);

  }

  for (
    let i = remaining.length - 1;
    i > 0;
    i--
  ) {

    const j =
      Math.floor(
        Math.random() * (i + 1)
      );

    [remaining[i], remaining[j]] =
    [remaining[j], remaining[i]];

  }

  const unviewed = [];
  const viewed = [];

  for (const video of remaining) {

    if (viewedIds.includes(video.public_id)) {
      viewed.push(video);
    } else {
      unviewed.push(video);
    }

  }

  const ordered = [
    ...unviewed,
    ...viewed
  ];

  for (const video of ordered) {

    if (data.length >= 20) {
      break;
    }

    usedVideos.add(video.public_id);

    data.push(video);

  }

}

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

      likes_count: video.likes_count || 0,
      
      comment_count:
        video.comment_count || 0
    };
  });

const start = (page - 1) * limit;
const end = start + limit;

return safeData.slice(start, end);
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