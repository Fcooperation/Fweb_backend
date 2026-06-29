import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

export default async function fvidsUserDetails(
  userId,
  viewerId = null
) {

  if (!userId) {
    throw new Error(
      "No user id provided"
    );
  }

  // ---------------- FOLLOWERS COUNT ----------------

  const {
    count: followersCount,
    error: followersError
  } = await supabase
    .from("fvidsfollow")
    .select("*", {
      count: "exact",
      head: true
    })
    .eq(
      "following_id",
      String(userId)
    );

  if (followersError) {
    throw new Error(
      followersError.message
    );
  }

  // ---------------- FOLLOWING COUNT ----------------

  const {
    count: followingCount,
    error: followingError
  } = await supabase
    .from("fvidsfollow")
    .select("*", {
      count: "exact",
      head: true
    })
    .eq(
      "follower_id",
      String(userId)
    );

  if (followingError) {
    throw new Error(
      followingError.message
    );
  }

  // ---------------- ACCOUNT DETAILS ----------------

const {
  data: account,
  error: accountError
} = await supabase
  .from("fwebaccount")
  .select("username, profile_pic")
  .eq("id", String(userId))
  .single();

if (accountError) {
  throw new Error(accountError.message);
}

  // ---------------- FOLLOW STATUS ----------------

let following = false;

if (
  viewerId &&
  String(viewerId) !== String(userId)
) {

  const {
    data: follow
  } = await supabase
    .from("fvidsfollow")
    .select("id")
    .eq(
      "follower_id",
      String(viewerId)
    )
    .eq(
      "following_id",
      String(userId)
    )
    .maybeSingle();

  following = !!follow;

}

  
  // ---------------- USER VIDEOS ----------------

  const {
  data: videos,
  error: videosError
} = await supabase
  .from("fvids")
  .select("*")
  .eq("user_id", String(userId))
  .order("created_at", { ascending: false });

  if (videosError) {
    throw new Error(
      videosError.message
    );
  }

  // ---------------- TOTAL LIKES ----------------

let totalLikes = 0;

const safeVideos =
  (videos || []).map(video => {

    let likesArray = [];

    try {

      likesArray = video.likes
        ? JSON.parse(video.likes)
        : [];

    } catch {

      likesArray = [];

    }

    totalLikes += likesArray.length;

    // Has the logged-in user liked this video?
    const liked =
      viewerId
        ? likesArray.includes(String(viewerId))
        : false;

    return {

      ...video,

      likes: undefined,

      liked,

      following,

      likes_count:
        likesArray.length,

      comment_count:
        video.comment_count || 0

    };

  });

  // ---------------- RESPONSE ----------------

  return {

  success: true,

  username:
    account?.username || "",

  profile_pic:
    account?.profile_pic || "",

  following,

  followers_count:
    followersCount || 0,

  following_count:
    followingCount || 0,

  likes_received:
    totalLikes,

  videos_count:
    safeVideos.length,

  videos:
    safeVideos

};
}