import "dotenv/config";
import { algoliasearch } from "algoliasearch";

const algolia = algoliasearch(
  process.env.ALGOLIA_APP_ID,
  process.env.ALGOLIA_SEARCH_API_KEY
);

export default async function fvidSearch(query) {

  if (!query) return [];

  const { hits } = await algolia.searchSingleIndex({
    indexName: process.env.ALGOLIA_INDEX,
    searchParams: {
      query,
      hitsPerPage: 20
    }
  });

  // Create one unique user result per user
  const usersMap = new Map();

  hits.forEach(hit => {

    if (!hit.user_id) return;

    if (!usersMap.has(hit.user_id)) {

      usersMap.set(hit.user_id, {
        type: "user",
        user_id: hit.user_id,
        username: hit.username,
        profile_pic: hit.profile_pic || "",
        followers: hit.followers || 0,
        following: hit.following || 0
      });

    }

  });

  const users = [...usersMap.values()];

  // Return videos first, then users
  return [
    ...hits,
    ...users
  ];

        }
