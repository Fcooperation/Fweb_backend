// fcrawler.js
import axios from "axios";
import * as cheerio from "cheerio";

// Function to handle search/crawling
export async function handleSearch(query) {
  const isLink = /^https?:\/\/|^[\w-]+\.[a-z]{2,}/i.test(query);

  if (!isLink) {
    return [
      {
        title: "Normal Search Ignored",
        url: null,
        snippet: "Normal text queries are not yet supported.",
        html: null,
        fcards: null
      }
    ];
  }

  // Normalize link
  const url = query.startsWith("http") ? query : "https://" + query;

  try {
    // Fetch page
    const response = await axios.get(url, {
      headers: { "User-Agent": "FwebCrawler/1.0 (+https://fweb.africa)" },
      timeout: 10000
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Extract text blocks
    let blocks = [];
    $("p, h1, h2, h3, h4, h5, h6, li").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 30) {
        blocks.push(text);
      }
    });

    // --- Case: JS-rendered site (no blocks found) ---
    if (blocks.length === 0) {
      return [
        {
          title: "Blocked by JS",
          url,
          snippet: "This site requires JavaScript. Showing fCards instead.",
          html: null, // no raw HTML
          fcards: [
            {
              title: $("title").first().text().trim() || "Untitled Page",
              url,
              snippet: "Preview unavailable due to JS rendering.",
              blocks: [] // empty because Cheerio couldn’t parse them
            }
          ]
        }
      ];
    }

    // --- Case: Normal static site ---
    return [
      {
        title: "Done Crawling",
        url,
        snippet: `Captured ${blocks.length} content blocks from the page.`,
        html, // ✅ send full HTML for iframe rendering
        fcards: null // no need for fCards
      }
    ];
  } catch (err) {
    console.error("❌ Crawl error:", err.message);

    if (err.response && err.response.status === 403) {
      return [
        {
          title: "Blocked by Robots",
          url,
          snippet: "Access forbidden (robots.txt or server block).",
          html: null,
          fcards: null
        }
      ];
    }

    return [
      {
        title: "Crawl Failed",
        url,
        snippet: err.message,
        html: null,
        fcards: null
      }
    ];
  }
}
