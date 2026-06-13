import { createClient } from "@supabase/supabase-js";

// helper so we don't duplicate logic
function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );
}

// ---------------- MAIN HANDLER ----------------
export default async function fvidsComment(req, res) {
  if (req.method === "POST") {
    return postComment(req, res);
  }

  if (req.method === "GET") {
    return getComments(req, res);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

// ================= POST =================
async function postComment(req, res) {
  const supabase = getSupabase();

  try {
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

    if (error) throw error;

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

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}

// ================= GET COMMENTS =================
async function getComments(req, res) {
  const supabase = getSupabase();

  try {
    const { videoId, page = 1, limit = 20 } = req.query;

    if (!videoId) {
      return res.status(400).json({ error: "videoId required" });
    }

    const start = (page - 1) * Number(limit);
    const end = start + Number(limit) - 1;

    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .eq("video_id", videoId)
      .order("created_at", { ascending: false })
      .range(start, end);

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.json([]);
    }

    const userIds = [...new Set(data.map(c => c.user_id))];

    const { data: users } = await supabase
      .from("fwebaccount")
      .select("id, username")
      .in("id", userIds);

    const userMap = {};
    (users || []).forEach(u => {
      userMap[u.id] = u.username;
    });

    const enriched = data.map(c => ({
      id: c.id,
      video_id: c.video_id,
      comment_text: c.comment_text,
      user_id: c.user_id,
      username: userMap[c.user_id] || "Unknown",
      created_at: c.created_at
    }));

    return res.status(200).json(enriched);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
           }
