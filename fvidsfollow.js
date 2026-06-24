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

  // already following?
  const { data: existing } =
    await supabase
      .from("fvidsfollow")
      .select("*")
      .eq("follower_id", followerId)
      .eq("following_id", followingId)
      .maybeSingle();

  if (existing) {
    return {
      success: true,
      message: "Already following"
    };
  }

  // create relationship
  const { error: followError } =
    await supabase
      .from("fvidsfollow")
      .insert({
        follower_id: followerId,
        following_id: followingId
      });

  if (followError) {
    throw followError;
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

  // update following count
  await supabase
    .from("fwebaccount")
    .update({
      following_count:
        (followerAccount.following_count || 0) + 1
    })
    .eq("id", followerId);

  // update follower count
  await supabase
    .from("fwebaccount")
    .update({
      followers_count:
        (followedAccount.followers_count || 0) + 1
    })
    .eq("id", followingId);

  return {
    success: true,
    message: "Followed successfully"
  };
}
