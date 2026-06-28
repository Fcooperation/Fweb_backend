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

  // ---------------- CHECK LAST 24 HOURS ----------------

  const since = new Date(
    Date.now() - (24 * 60 * 60 * 1000)
  ).toISOString();

  let checkQuery = supabase
    .from("fvid_views")
    .select("id")
    .eq("video_public_id", publicId)
    .gte("viewed_at", since)
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

  // ---------------- ALREADY VIEWED ----------------

  if (existingView.length > 0) {

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

  // ---------------- INSERT VIEW ----------------

  const {
    error: insertError
  } = await supabase
    .from("fvid_views")
    .insert({
      video_public_id: publicId,
      user_id: userId,
      device_id: deviceId
    });

  if (insertError) {
    throw insertError;
  }

  // ---------------- GET CURRENT COUNT ----------------

  const {
    data: currentVideo,
    error: currentError
  } = await supabase
    .from("fvids")
    .select("views_count")
    .eq("public_id", publicId)
    .single();

  if (currentError) {
    throw currentError;
  }

  const newCount =
    (currentVideo.views_count || 0) + 1;

  // ---------------- UPDATE COUNT ----------------

  const {
    error: updateError
  } = await supabase
    .from("fvids")
    .update({
      views_count: newCount
    })
    .eq("public_id", publicId);

  if (updateError) {
    throw updateError;
  }

  return {
    success: true,
    counted: true,
    views: newCount
  };

}