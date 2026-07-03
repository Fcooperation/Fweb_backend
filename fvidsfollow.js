import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

export default async function fvidFollow(data) {

  const {
    followerId,
    followingId
  } = data;

  if (!followerId || !followingId) {
    throw new Error("Missing IDs");
  }

  if (followerId === followingId) {
    throw new Error("Cannot follow yourself");
  }

  // ---------------- CHECK EXISTING ----------------

  const {
    data: existing
  } = await supabase
    .from("fvidsfollow")
    .select("*")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .maybeSingle();

  // ==================================================
  // UNFOLLOW
  // ==================================================

  if (existing) {

    const { error } = await supabase
      .from("fvidsfollow")
      .delete()
      .eq("follower_id", followerId)
      .eq("following_id", followingId);

    if (error) {
      throw error;
    }

    // get follower account
    const {
      data: followerAccount
    } = await supabase
      .from("fwebaccount")
      .select("following_count")
      .eq("id", followerId)
      .single();

    // get followed account
    const {
      data: followedAccount
    } = await supabase
      .from("fwebaccount")
      .select("followers_count")
      .eq("id", followingId)
      .single();

    // decrease following count
    await supabase
      .from("fwebaccount")
      .update({
        following_count: Math.max(
          (followerAccount?.following_count || 0) - 1,
          0
        )
      })
      .eq("id", followerId);

    // decrease followers count
    await supabase
      .from("fwebaccount")
      .update({
        followers_count: Math.max(
          (followedAccount?.followers_count || 0) - 1,
          0
        )
      })
      .eq("id", followingId);

    return {
      success: true,
      following: false,
      message: "Unfollowed successfully"
    };

  }

  // ==================================================
  // FOLLOW
  // ==================================================

  const {
    error: followError
  } = await supabase
    .from("fvidsfollow")
    .insert({
      follower_id: followerId,
      following_id: followingId
    });

  if (followError) {
    throw followError;
  }

  // ---------------- GET FOLLOWED USER CATEGORY ----------------

const {
  data: latestVideo,
  error: categoryError
} = await supabase
  .from("fvids")
  .select("category")
  .eq("user_id", followingId)
  .order("created_at", {
    ascending: false
  })
  .limit(1)
  .maybeSingle();

if (categoryError) {
  throw categoryError;
}

// ---------------- UPDATE CATEGORY SCORE ----------------

if (latestVideo?.category) {

  const {
    data: existingCategory,
    error: existingError
  } = await supabase
    .from("user_category_scores")
    .select("score")
    .eq("user_id", followerId)
    .eq("category", latestVideo.category)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingCategory) {

    // Category already exists
    const { error: updateError } = await supabase
      .from("user_category_scores")
      .update({
        score: Number(existingCategory.score) + 35,
        last_updated: new Date().toISOString()
      })
      .eq("user_id", followerId)
      .eq("category", latestVideo.category);

    if (updateError) {
      throw updateError;
    }

  } else {

    // User has never interacted with this category before
    const { error: insertError } = await supabase
      .from("user_category_scores")
      .insert({
        user_id: followerId,
        category: latestVideo.category,
        score: 35,
        videos_watched: 0
      });

    if (insertError) {
      throw insertError;
    }

  }

}

  // get follower account
  const {
    data: followerAccount
  } = await supabase
    .from("fwebaccount")
    .select("following_count")
    .eq("id", followerId)
    .single();

  // get followed account
  const {
    data: followedAccount
  } = await supabase
    .from("fwebaccount")
    .select("followers_count")
    .eq("id", followingId)
    .single();

  // increase following count
  await supabase
    .from("fwebaccount")
    .update({
      following_count:
        (followerAccount?.following_count || 0) + 1
    })
    .eq("id", followerId);

  // increase followers count
  await supabase
    .from("fwebaccount")
    .update({
      followers_count:
        (followedAccount?.followers_count || 0) + 1
    })
    .eq("id", followingId);

  return {
    success: true,
    following: true,
    message: "Followed successfully"
  };

    }