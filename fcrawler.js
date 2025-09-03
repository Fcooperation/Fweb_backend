// fcrawler.js
import axios from "axios";

export async function handleSearch(query) {
  const isLink = /^https?:\/\/|^[\w-]+\.[a-z]{2,}/i.test(query);

  if (!isLink) {
    // Normal text query
    return [
      {
        title: "Normal Search",
        url: null,
        snippet: "This is a normal search query, not a URL.",
        html: null,
        type: "normalSearch"
      }
    ];
  }

  // Normalize link
  const url = query.startsWith("http") ? query : "https://" + query;

  // Instead of crawling, just send back the link
  return [
    {
      title: "Link Search",
      url,
      snippet: "This search is a URL and is sent directly back to the frontend.",
      html: null,
      type: "link"
    }
  ];
}
