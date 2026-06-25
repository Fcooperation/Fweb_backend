import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_KEY
);

export default async function followingFeed(req) {

const userId = req.query.userId;

const page = parseInt(req.query.page || "1", 10);
const limit = 20;

const from = (page - 1) * limit;
const to = from + limit - 1;

if (!userId) {
throw new Error("Missing userId");
}

// --------------------------
// GET FOLLOWED USERS
// --------------------------
const { data: followingRows, error: followError } =
await supabase
.from("fvidsfollow")
.select("following_id")
.eq("follower_id", userId);

if (followError) {
throw followError;
}

const followingIds =
followingRows?.map(row => row.following_id) || [];

if (!followingIds.length) {
return [];
}

// --------------------------
// GET VIDEOS
// --------------------------
const { data: videos, error: videoError } =
await supabase
.from("fvids")
.select("*")
.in("user_id", followingIds)
.order("created_at", { ascending: false })
.range(from, to);

if (videoError) {
throw videoError;
}

if (!videos?.length) {
return [];
}

// --------------------------
// GET USER DETAILS
// --------------------------
const creatorIds = [
  ...new Set(
    videos.map(v => String(v.user_id))
  )
];

const { data: users, error: userError } =
await supabase
  .from("fwebaccount")
  .select("id, username, profile_pic")
  .in("id", creatorIds);

if (userError) {
  throw userError;
}

const userMap = {};

users.forEach(user => {
  userMap[String(user.id)] = {
    username: user.username,
    profile_pic: user.profile_pic
  };
});

// --------------------------
// ATTACH USER DETAILS
// --------------------------
const enrichedVideos = videos.map(video => ({
  ...video,
  user: userMap[String(video.user_id)] || null
}));

return enrichedVideos;
}
