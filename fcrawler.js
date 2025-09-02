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
        blocks: [] // keep consistent return shape
      }
    ];
  }

  // Normalize link
  const url = query.startsWith("http") ? query : "https://" + query;

  try {
    // Fetch page
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "FwebCrawler/1.0 (+https://fweb.africa)"
      },
      timeout: 10000
    });

    const html = response.data;

    // Load HTML into cheerio
    const $ = cheerio.load(html);

    // Extract text blocks (for fallback when JS only)
    let blocks = [];
    $("p, h1, h2, h3, h4, h5, h6, li").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 30) {
        blocks.push(text);
      }
    });

    // If no blocks → JS-rendered → use fCards only
    if (blocks.length === 0) {
      return [
        {
          title: "Blocked by JS",
          url,
          snippet: "This site requires JavaScript and cannot be crawled with static HTML.",
          html: null,     // no raw HTML
          blocks          // send blocks for fCards
        }
      ];
    }

    // ✅ Static site → return raw HTML only
    return [
      {
        title: "Done Crawling",
        url,
        snippet: `Captured ${blocks.length} content blocks from the page.`,
        html,     // full raw html
        blocks: [] // don't send fCards here
      }
    ];
  } catch (err) {
    console.error("❌ Crawl error:", err.message);

    if (err.response && err.response.status === 403) {
      return [
        {
          title: "Blocked by Robots",
          url,
          snippet: "Access to this page was forbidden (robots.txt or server block).",
          html: null,
          blocks: []
        }
      ];
    }

    return [
      {
        title: "Crawl Failed",
        url,
        snippet: err.message,
        html: null,
        blocks: []
      }
    ];
  }
}
