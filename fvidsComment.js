import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// Supabase setup (same style as login)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// ---------------- MAIN HANDLER ----------------
export default async function fvidsComment(req, res) {
  try {
    if (req.method === "POST") {
      return await postComment(req, res);
    }

    if (req.method === "GET") {
      return await getComments(req, res);
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (err) {
    console.error("COMMENTS ROUTE ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

// ================= POST COMMENT =================
async function postComment(req, res) {
  const { videoId, videoUrl, userId, commentText } = req.body;

  if (!videoId || !videoUrl || !userId || !commentText) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const { data, error } = await supabase
    .from("comments")
    .insert([
      {
        video_id: videoId,
        video_url: videoUrl,
        user_id: userId,
        comment_text: commentText
      }
    ])
    .select();

  if (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }

  // update comment count
  const { count } = await supabase
    .from("comments")
    .select("*", { count: "exact", head: true })
    .eq("video_id", videoId);

  await supabase
    .from("fvids")
    .update({ comment_count: count || 0 })
    .eq("id", videoId);

  return res.status(200).json({
    success: true,
    comment: data[0]
  });
}

// ================= GET COMMENTS (PAGINATION) =================
async function getComments(req, res) {
  const { videoId, page = 1, limit = 20 } = req.query;

  if (!videoId) {
    return res.status(400).json({ error: "videoId required" });
  }

  const start = (page - 1) * limit;
  const end = start + limit - 1;

  // fetch comments
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("video_id", videoId)
    .order("created_at", { ascending: false })
    .range(start, end);

  if (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }

  if (!data || data.length === 0) {
    return res.status(200).json([]);
  }

  // get usernames
  const userIds = [...new Set(data.map(c => c.user_id))];

  const { data: users } = await supabase
    .from("fwebaccount")
    .select("id, username")
    .in("id", userIds);

  const userMap = {};
  (users || []).forEach(u => {
    userMap[u.id] = u.username;
  });

  // format response
  const result = data.map(c => ({
    id: c.id,
    video_id: c.video_id,
    comment_text: c.comment_text,
    user_id: c.user_id,
    username: userMap[c.user_id] || "Unknown",
    created_at: c.created_at
  }));

  return res.status(200).json(result);
      }
