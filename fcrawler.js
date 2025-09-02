// fcrawler.js
import axios from "axios";
import * as cheerio from "cheerio";
import { runFcards } from "./fcards.js";

// Function to handle search/crawling
export async function handleSearch(query) {
  const isLink = /^https?:\/\/|^[\w-]+\.[a-z]{2,}/i.test(query);

  if (!isLink) {
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

  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "FwebCrawler/1.0 (+https://fweb.africa)"
      },
      timeout: 10000
    });

    const html = response.data;
    const $ = cheerio.load(html);

    let blocks = [];
    $("p, h1, h2, h3, h4, h5, h6, li").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 30) blocks.push(text);
    });

    if (blocks.length === 0) {
      console.log("⚡ Forwarding to fcards.js for JS-rendered site...");
      return await runFcards(url);
    }

    return [
      {
        title: "Done Crawling",
        url,
        snippet: `Captured ${blocks.length} content blocks from the page.`,
        html,
        type: "static"
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
          type: "robotsBlocked"
        }
      ];
    }

    return [
      {
        title: "Crawl Failed",
        url,
        snippet: err.message,
        html: null,
        type: "error"
      }
    ];
  }
}
