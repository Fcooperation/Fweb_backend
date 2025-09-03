// fcrawler.js
import axios from "axios";
import * as cheerio from "cheerio";

// Hardcoded trusted sources
const sources = [
  (q) => `https://en.wikipedia.org/wiki/${encodeURIComponent(q)}`,
  (q) => `https://www.britannica.com/search?query=${encodeURIComponent(q)}`,
  (q) => `https://www.petmd.com/search?query=${encodeURIComponent(q)}`
];

export async function handleSearch(query) {
  const isLink = /^https?:\/\/|^[\w-]+\.[a-z]{2,}/i.test(query);

  if (!isLink) {
    // 🔹 Normal search → fetch from trusted sources
    const cards = [];

    for (const buildUrl of sources) {
      const url = buildUrl(query);
      try {
        const response = await axios.get(url, {
          headers: { "User-Agent": "FwebFcards/1.0 (+https://fweb.africa)" },
          timeout: 8000
        });

        const html = response.data;
        const $ = cheerio.load(html);

        // Extract title, snippet, favicon
        const title = $("title").first().text().trim() || url;
        const snippet =
          $("p").first().text().trim().substring(0, 200) ||
          "No snippet available.";
        let favicon =
          $('link[rel="icon"]').attr("href") ||
          $('link[rel="shortcut icon"]').attr("href") ||
          "/favicon.ico";

        if (favicon && !favicon.startsWith("http")) {
          favicon = new URL(favicon, url).href;
        }

        cards.push({
          title,
          url,
          favicon,
          snippet,
          type: "fcards"
        });
      } catch (err) {
        console.error("❌ Fcards fetch failed for", url, err.message);
      }
    }

    // Return collected fcards
    return cards.length > 0
      ? cards
      : [
          {
            title: "No Results",
            url: null,
            snippet: "No fcards could be generated for this query.",
            html: null,
            type: "fcards-empty"
          }
        ];
  }

  // 🔹 Link search → send back to frontend
  const url = query.startsWith("http") ? query : "https://" + query;
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
