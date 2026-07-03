import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// ---------------- SUPABASE ----------------
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

export default async function fViews(data) {

  const {
    publicId,
    userId = null,
    deviceId = null
  } = data;

  if (!publicId) {
    throw new Error("Missing publicId");
  }

  if (!userId && !deviceId) {
    throw new Error("Missing viewer identity");
  }

  // ---------------- CHECK IF VIEW ALREADY EXISTS ----------------

  let checkQuery = supabase
    .from("fvid_views")
    .select("id, viewed_at")
    .eq("video_public_id", publicId)
    .limit(1);

  if (userId) {
    checkQuery = checkQuery.eq("user_id", userId);
  } else {
    checkQuery = checkQuery.eq("device_id", deviceId);
  }

  const {
    data: existingView,
    error: checkError
  } = await checkQuery;

  if (checkError) {
    throw checkError;
  }

  // ---------------- CHECK 24 HOURS ----------------

if (existingView.length > 0) {

  const lastViewed =
    new Date(existingView[0].viewed_at);

  const now = new Date();

  const hoursPassed =
    (now - lastViewed) / (1000 * 60 * 60);

  if (hoursPassed < 24) {

    const {
      data: video,
      error
    } = await supabase
      .from("fvids")
      .select("views_count")
      .eq("public_id", publicId)
      .single();

    if (error) throw error;

    return {
      success: true,
      counted: false,
      views: video.views_count || 0
    };

  }

}

  // Remove old record if it exists
if (existingView.length > 0) {

  await supabase
    .from("fvid_views")
    .delete()
    .eq("id", existingView[0].id);

}
  
  // ---------------- INSERT VIEW ----------------

  const {
    error: insertError
  } = await supabase
    .from("fvid_views")
    .insert({
      video_public_id: publicId,
      user_id: userId || null,
      device_id: userId ? null : deviceId
    });

  if (insertError) {
    throw insertError;
  }
// ---------------- UPDATE CATEGORY SCORE ----------------

if (userId) {

  // Get the video's category
  const {
    data: video,
    error: videoError
  } = await supabase
    .from("fvids")
    .select("category")
    .eq("public_id", publicId)
    .single();

  if (videoError) {
    throw videoError;
  }

  if (video?.category) {

    // Check if user already has this category
    const {
      data: existingCategory,
      error: existingError
    } = await supabase
      .from("user_category_scores")
      .select("score")
      .eq("user_id", userId)
      .eq("category", video.category)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingCategory) {

      // Increase score
      const {
        error: updateError
      } = await supabase
        .from("user_category_scores")
        .update({
          score: Number(existingCategory.score) + 5,
          last_updated: new Date().toISOString()
        })
        .eq("user_id", userId)
        .eq("category", video.category);

      if (updateError) {
        throw updateError;
      }

    } else {

      // First interaction with this category
      const {
        error: insertError
      } = await supabase
        .from("user_category_scores")
        .insert({
          user_id: userId,
          category: video.category,
          score: 5,
          videos_watched: 1
        });

      if (insertError) {
        throw insertError;
      }

    }

  }

}


  // ---------------- INCREMENT VIEW COUNT ----------------

  const {
    data: newCount,
    error: rpcError
  } = await supabase.rpc(
    "increment_video_views",
    {
      video_id: publicId
    }
  );

  if (rpcError) {
    throw rpcError;
  }

  return {
    success: true,
    counted: true,
    views: newCount
  };

    }