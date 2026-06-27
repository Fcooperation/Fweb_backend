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

  return hits;

}
