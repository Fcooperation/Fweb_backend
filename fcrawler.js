import { handleNormalSearch } from "./fcrawler2.js";

export async function handleSearch(query) {
  const isLink = /^https?:\/\/|^[\w-]+\.[a-z]{2,}/i.test(query);

  if (!isLink) {
    // Delegate to fcrawler2
    return await handleNormalSearch(query);
  }

  // 🔹 Link search
  const url = query.startsWith("http") ? query : "https://" + query;
  return [
    {
      title: "Link Search",
      url,
      snippet: "This search is a URL and is sent directly back to the frontend.",
      html: null,
      type: "link",
    },
  ];
}
