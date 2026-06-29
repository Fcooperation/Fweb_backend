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
      hitsPerPage: 20,
      attributesToHighlight: [
        "username",
        "hashtags",
        "details",
        "category"
      ]
    }
  });

  const suggestions = [];
  const seen = new Set();

  for (const hit of hits) {

    const highlight = hit._highlightResult || {};

    // ---------------- USERNAME ----------------
    if (
      highlight.username?.matchLevel !== "none" &&
      hit.username
    ) {

      const username = String(hit.username);

      if (!seen.has(`user:${username.toLowerCase()}`)) {

        seen.add(`user:${username.toLowerCase()}`);

        suggestions.push({
          type: "user",
          value: username,
          profile_pic: hit.profile_pic || ""
        });

      }

    }

    // ---------------- DETAILS ----------------
    if (
      highlight.details?.matchLevel !== "none" &&
      hit.details
    ) {

      const details = String(hit.details);

      if (!seen.has(`details:${details.toLowerCase()}`)) {

        seen.add(`details:${details.toLowerCase()}`);

        suggestions.push({
          type: "details",
          value:
            details.length > 50
              ? details.slice(0, 50) + "..."
              : details
        });

      }

    }

    // ---------------- CATEGORY ----------------
    if (
      highlight.category?.matchLevel !== "none" &&
      hit.category
    ) {

      const category = String(hit.category);

      if (!seen.has(`category:${category.toLowerCase()}`)) {

        seen.add(`category:${category.toLowerCase()}`);

        suggestions.push({
          type: "category",
          value: category
        });

      }

    }

    // ---------------- HASHTAGS ----------------
    if (
      Array.isArray(hit.hashtags) &&
      Array.isArray(highlight.hashtags)
    ) {

      hit.hashtags.forEach((tag, i) => {

        if (
          highlight.hashtags[i]?.matchLevel !== "none"
        ) {

          const hashtag = String(tag);

          if (
            !seen.has(`tag:${hashtag.toLowerCase()}`)
          ) {

            seen.add(`tag:${hashtag.toLowerCase()}`);

            suggestions.push({
              type: "hashtag",
              value: hashtag
            });

          }

        }

      });

    }

    if (suggestions.length >= 5) {
      break;
    }

  }

  return suggestions.slice(0, 5);

}
