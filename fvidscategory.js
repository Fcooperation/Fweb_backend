import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function fvidCategory(req, res) {
  try {
    const { userId, category } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required"
      });
    }

    if (!Array.isArray(category) || category.length === 0) {
      return res.status(400).json({
        success: false,
        message: "category must be a non-empty array"
      });
    }

    // One row per selected category
    const rows = category.map(cat => ({
      user_id: userId,
      category: cat,
      score: 100,          // Initial preference score
      videos_watched: 0
    }));

    const { error } = await supabase
      .from("user_category_scores")
      .upsert(rows, {
        onConflict: "user_id,category"
      });

    if (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: error.message
      });
    }

    return res.json({
      success: true,
      message: "Categories saved successfully."
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Internal server error."
    });
  }
}