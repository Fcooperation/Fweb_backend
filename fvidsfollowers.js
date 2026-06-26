import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

export default async function fvidFollowers(
  userId,
  page = 1,
  limit = 20
) {

  if (!userId) {
    throw new Error("No user id provided");
  }

  const from =
    (page - 1) * limit;

  const to =
    from + limit - 1;

  // ---------------- GET FOLLOWERS ----------------

  const {
    data: followers,
    error
  } = await supabase
    .from("fvidsfollow")
    .select("*")
    .eq(
      "following_id",
      String(userId)
    )
    .order(
      "created_at",
      { ascending: false }
    )
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  if (!followers.length) {
    return [];
  }

  // ---------------- GET USER IDS ----------------

  const ids =
    followers.map(
      x => String(x.follower_id)
    );

  // ---------------- LOAD ACCOUNT DETAILS ----------------

  const {
    data: accounts,
    error: accountError
  } = await supabase
    .from("fwebaccount")
    .select(
      "user_id,username,profile_pic"
    )
    .in(
      "user_id",
      ids
    );

  if (accountError) {
    throw new Error(
      accountError.message
    );
  }

  // ---------------- MERGE ----------------

  return followers.map(follower => {

    const account =
      accounts.find(
        x =>
          String(x.user_id) ===
          String(follower.follower_id)
      );

    return {

      ...follower,

      username:
        account?.username || "",

      profile_pic:
        account?.profile_pic || ""

    };

  });

    }
