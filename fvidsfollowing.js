import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

export default async function fvidFollowing(
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

  // ---------------- GET FOLLOWING ----------------

  const {
    data: following,
    error
  } = await supabase
    .from("fvidsfollow")
    .select("*")
    .eq(
      "follower_id",
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

  if (!following.length) {
    return [];
  }

  // ---------------- GET IDS ----------------

  const ids =
    following.map(
      x => String(x.following_id)
    );

  // ---------------- LOAD ACCOUNT DETAILS ----------------

  const {
    data: accounts,
    error: accountError
  } = await supabase
    .from("fwebaccount")
    .select(
      "id,username,profile_pic"
    )
    .in(
      "id",
      ids
    );

  if (accountError) {
    throw new Error(
      accountError.message
    );
  }

  // ---------------- MERGE ----------------

  return following.map(follow => {

    const account =
      accounts.find(
        x =>
          String(x.id) ===
          String(follow.following_id)
      );

    return {

      ...follow,

      username:
        account?.username || "",

      profile_pic:
        account?.profile_pic || ""

    };

  });

      }
