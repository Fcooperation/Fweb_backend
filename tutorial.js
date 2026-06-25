import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const userId = req.query.userId || null;

    const limit = 10;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error } = await supabase
      .from("fvids")
      .select("*")
      .eq("category", "tutorial")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    // ---------------- USERS ----------------

const userIds = [
  ...new Set(
    (data || [])
      .map(v => v.user_id)
      .filter(Boolean)
  )
];

let usersMap = {};

if (userIds.length) {

  const {
    data: users,
    error: usersError
  } = await supabase
    .from("fwebaccount")
    .select("id, username, profile_pic")
    .in("id", userIds);

  if (usersError) throw usersError;

  usersMap = Object.fromEntries(
    users.map(user => [
      String(user.id),
      {
        username: user.username,
        profile_pic: user.profile_pic
      }
    ])
  );
}

// ---------------- FOLLOWING ----------------

let followingMap = {};

if (userId) {

  const {
    data: follows,
    error: followError
  } = await supabase
    .from("fvidsfollow")
    .select("following_id")
    .eq("follower_id", String(userId));

  if (followError) throw followError;

  followingMap = Object.fromEntries(
    (follows || []).map(row => [
      String(row.following_id),
      true
    ])
  );
}

// ---------------- ENRICH VIDEOS ----------------

const result = (data || []).map(video => {

  let liked = false;
  let likesArray = [];

  try {

    likesArray =
      typeof video.likes === "string"
        ? JSON.parse(video.likes)
        : (video.likes || []);

    liked = userId
      ? likesArray.includes(String(userId))
      : false;

  } catch {
    liked = false;
    likesArray = [];
  }

  const { likes, ...safeVideo } = video;

  return {
    ...safeVideo,

    user:
      usersMap[
        String(video.user_id)
      ] || null,

    liked,

    following: userId
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

res.json(result);
    } catch (err) {
  console.error("Tutorial fetch error:", err);

  res.status(500).json({
    error: "Failed to fetch tutorials"
  });
}
});

export default router;