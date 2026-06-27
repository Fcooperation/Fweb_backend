import "dotenv/config";
import { algoliasearch } from "algoliasearch";
import { createClient } from "@supabase/supabase-js";

// ---------------- ALGOLIA ----------------
const algolia = algoliasearch(
  process.env.ALGOLIA_APP_ID,
  process.env.ALGOLIA_SEARCH_API_KEY
);

// ---------------- SUPABASE ----------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function fvidSearch(query) {

  if (!query) return [];

  // Search more hits so user extraction is better
  const { hits } = await algolia.searchSingleIndex({
    indexName: process.env.ALGOLIA_INDEX,
    searchParams: {
      query,
      hitsPerPage: 50
    }
  });

  // ---------------- UNIQUE USERS ----------------
  const usersMap = new Map();

  hits.forEach(hit => {

    if (!hit.user_id) return;

    if (!usersMap.has(hit.user_id)) {
      usersMap.set(hit.user_id, {
        type: "user",
        user_id: hit.user_id
      });
    }

  });

  const users = [];

  // ---------------- ENRICH USERS ----------------
  await Promise.all(

    [...usersMap.values()].map(async (user) => {

      const userId = String(user.user_id);

      // Run all DB queries in parallel
      const [

        accountResult,

        followersResult,

        followingResult,

        videosResult

      ] = await Promise.all([

        // Latest username/profile picture
        supabase
          .from("fwebaccount")
          .select("username, profile_pic")
          .eq("id", userId)
          .maybeSingle(),

        // Followers
        supabase
          .from("fvidsfollow")
          .select("*", { count: "exact", head: true })
          .eq("following_id", userId),

        // Following
        supabase
          .from("fvidsfollow")
          .select("*", { count: "exact", head: true })
          .eq("follower_id", userId),

        // Videos count
        supabase
          .from("fvids")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)

      ]);

      users.push({

        type: "user",

        user_id: userId,

        username:
          accountResult.data?.username || "",

        profile_pic:
          accountResult.data?.profile_pic || "",

        followers:
          followersResult.count || 0,

        following:
          followingResult.count || 0,

        videos_count:
          videosResult.count || 0

      });

    })

  );

  // Videos first, users after
  return [

    ...hits,

    ...users

  ];

}