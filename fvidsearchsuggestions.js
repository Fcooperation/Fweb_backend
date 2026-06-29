import "dotenv/config";
import { algoliasearch } from "algoliasearch";

// ---------------- ALGOLIA ----------------
const algolia = algoliasearch(
  process.env.ALGOLIA_APP_ID,
  process.env.ALGOLIA_SEARCH_API_KEY
);

export default async function fvidSearchSuggestions(query) {

  if (!query?.trim()) return [];

  const q = query.trim();

  const { hits } = await algolia.searchSingleIndex({
    indexName: process.env.ALGOLIA_INDEX,
    searchParams: {
      query: q,
      hitsPerPage: 20
    }
  });

  const suggestions = [];
  const seen = new Set();

  for (const hit of hits) {

    // Username suggestion
    if (hit.username) {

      const username = String(hit.username);

      if (
        username.toLowerCase().includes(q.toLowerCase()) &&
        !seen.has(`user:${username.toLowerCase()}`)
      ) {

        seen.add(`user:${username.toLowerCase()}`);

        suggestions.push({
          type: "user",
          value: username,
          profile_pic: hit.profile_pic || ""
        });

      }

    }

    // Hashtag suggestions
    if (Array.isArray(hit.hashtags)) {

      for (const tag of hit.hashtags) {

        const hashtag = String(tag);

        if (
          hashtag.toLowerCase().includes(q.toLowerCase()) &&
          !seen.has(`tag:${hashtag.toLowerCase()}`)
        ) {

          seen.add(`tag:${hashtag.toLowerCase()}`);

          suggestions.push({
            type: "hashtag",
            value: hashtag
          });

        }

      }

    }

    // Stop at 5 suggestions
    if (suggestions.length >= 5) {
      break;
    }

  }

  return suggestions.slice(0, 5);

}