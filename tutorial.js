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
    const userId = req.query.userId || null; // frontend may or may not send this

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

    const result = (data || []).map((video) => {
      let liked = false;

      // only check if userId exists AND likes exists
      if (userId && video.likes) {
        try {
          const likesArray =
            typeof video.likes === "string"
              ? JSON.parse(video.likes)
              : video.likes;

          liked = Array.isArray(likesArray)
            ? likesArray.includes(userId)
            : false;
        } catch (e) {
          liked = false;
        }
      }

      return {
        ...video,
        liked
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
