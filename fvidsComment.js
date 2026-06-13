async function getComments(req, res, supabase) {
  try {
    const {
      videoId,
      page = 1,
      limit = 20
    } = req.query;

    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: "videoId required"
      });
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);

    const start = (pageNum - 1) * limitNum;
    const end = start + limitNum - 1;

    // ---------------- FETCH COMMENTS ----------------
    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .eq("video_id", videoId)
      .order("created_at", { ascending: false })
      .range(start, end);

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    if (!data || data.length === 0) {
      return res.status(200).json({
        success: true,
        comments: [],
        hasMore: false
      });
    }

    // ---------------- GET USERNAMES ----------------
    const userIds = [...new Set(data.map(c => c.user_id))];

    const { data: users, error: userError } = await supabase
      .from("fwebaccount")
      .select("id, username")
      .in("id", userIds);

    if (userError) {
      return res.status(500).json({
        success: false,
        error: userError.message
      });
    }

    const userMap = {};
    (users || []).forEach(u => {
      userMap[u.id] = u.username;
    });

    // ---------------- FORMAT RESPONSE ----------------
    const comments = data.map(c => ({
      id: c.id,
      video_id: c.video_id,
      comment_text: c.comment_text,
      user_id: c.user_id,
      username: userMap[c.user_id] || "Unknown",
      created_at: c.created_at
    }));

    // ---------------- CHECK IF MORE ----------------
    const hasMore = data.length === limitNum;

    return res.status(200).json({
      success: true,
      comments,
      page: pageNum,
      hasMore
    });

  } catch (err) {
    console.error("GET COMMENTS ERROR:", err);
    return res.status(500).json({
      success: false,
      error: "Server error"
    });
  }
        }
