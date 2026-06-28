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

  // ---------------- GET LATEST VIDEOS ----------------

const videoIds = hits
  .map(hit => hit.video_id)
  .filter(Boolean);

const {
  data: latestVideos,
  error: latestError
} = await supabase
  .from("fvids")
  .select("*")
  .in("id", videoIds);

// ---------------- CREATE LOOKUP ----------------

const latestMap = new Map();

(latestVideos || []).forEach(video => {

  latestMap.set(
    String(video.id),
    video
  );

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

// ---------------- UPDATE VIDEO HITS ----------------
hits.forEach(hit => {

  const latest =
  latestMap.get(String(hit.video_id));

  if (!latest) return;

  // Merge latest data from Supabase
  Object.assign(hit, latest);

  // Keep username/profile pic fresh too
  if (String(hit.user_id) === userId) {

    hit.username =
      accountResult.data?.username || hit.username;

    hit.profile_pic =
      accountResult.data?.profile_pic || hit.profile_pic;

  }

});


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

  // ---------------- SORT VIDEOS ----------------
const q = query.trim().toLowerCase();

hits.sort((a, b) => {

  const score = (video) => {

    let points = 0;

    // Exact username match
    if ((video.username || "").toLowerCase() === q) {
      points += 1000;
    }

    // Exact hashtag match
    if (
      Array.isArray(video.hashtags) &&
      video.hashtags.some(
        tag => String(tag).toLowerCase() === q
      )
    ) {
      points += 800;
    }

    // Partial username match
    if (
      (video.username || "")
        .toLowerCase()
        .includes(q)
    ) {
      points += 400;
    }

    // Partial hashtag match
    if (
      Array.isArray(video.hashtags) &&
      video.hashtags.some(
        tag => String(tag)
          .toLowerCase()
          .includes(q)
      )
    ) {
      points += 300;
    }

    // Likes
    points += Number(video.likes_count || 0);

    return points;

  };

  const scoreA = score(a);
  const scoreB = score(b);

  if (scoreA !== scoreB) {
    return scoreB - scoreA;
  }

  // If scores tie, newer first
  return new Date(b.created_at) - new Date(a.created_at);

});

  // ---------------- BUILD HASHTAGS ----------------

const hashtagsMap = new Map();

hits.forEach(video => {

  if (!Array.isArray(video.hashtags)) return;

  video.hashtags.forEach(tag => {

    if (!tag) return;

    const name = String(tag).trim().toLowerCase();

    // Only hashtags related to the search
    if (!name.includes(q)) return;

    if (!hashtagsMap.has(name)) {

      hashtagsMap.set(name, {
        type: "hashtag",
        tag: name,
        count: 1
      });

    } else {

      hashtagsMap.get(name).count++;

    }

  });

});

const hashtags =
  [...hashtagsMap.values()]
  .sort((a, b) => b.count - a.count);

// Videos first, users after
return [
  ...hits,
  ...users,
  ...hashtags
];
        }
