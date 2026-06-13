import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// ---------------- SUPABASE INIT ----------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ---------------- POST COMMENT ----------------
export async function postComment(req, res) {
  try {
    const {
      videoId,
      videoUrl,
      userId,
      commentText
    } = req.body;

    if (!videoId || !videoUrl || !userId || !commentText) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields"
      });
    }

    // insert comment
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

    // update comment count
    const { count } = await supabase
      .from("comments")
      .select("*", { count: "exact", head: true })
      .eq("video_id", videoId);

    await supabase
      .from("fvids")
      .update({
        comment_count: count || 0
      })
      .eq("id", videoId);

    return res.status(200).json({
      success: true,
      comment: data[0]
    });

  } catch (err) {
    console.error("POST COMMENT ERROR:", err.message);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

// ---------------- GET COMMENTS (PAGINATED) ----------------
export async function getComments(req, res) {
  try {
    const {
      videoId,
      page = 1,
      limit = 20
    } = req.query;

    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: "videoId is required"
      });
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);

    const start = (pageNum - 1) * limitNum;
    const end = start + limitNum - 1;

    // ---------------- FETCH COMMENTS ----------------
    const { data: comments, error } = await supabase
      .from("comments")
      .select("*")
      .eq("video_id", videoId)
      .order("created_at", { ascending: false })
      .range(start, end);

    if (error) throw error;

    if (!comments || comments.length === 0) {
      return res.json({
        success: true,
        comments: [],
        hasMore: false
      });
    }

    // ---------------- GET USER IDS ----------------
    const userIds = [...new Set(comments.map(c => c.user_id))];

    const { data: users } = await supabase
      .from("fwebaccount")
      .select("id, username")
      .in("id", userIds);

    const userMap = {};
    (users || []).forEach(u => {
      userMap[u.id] = u.username;
    });

    // ---------------- ENRICH COMMENTS ----------------
    const enriched = comments.map(c => ({
      id: c.id,
      videoId: c.video_id,
      text: c.comment_text,
      userId: c.user_id,
      username: userMap[c.user_id] || "Unknown",
      createdAt: c.created_at
    }));

    return res.json({
      success: true,
      comments: enriched,
      page: pageNum,
      hasMore: comments.length === limitNum
    });

  } catch (err) {
    console.error("GET COMMENTS ERROR:", err.message);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
    }
