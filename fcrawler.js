// fcrawler.js
import axios from "axios";
import * as cheerio from "cheerio";

export async function handleSearch(query) {
  const isLink = /^https?:\/\/|^[\w-]+\.[a-z]{2,}/i.test(query);

  if (!isLink) {
    return [
      {
        title: "Normal Search Ignored",
        url: null,
        snippet: "Normal text queries are not yet supported.",
        favicon: null,
        blocks: [],
        html: null,
        mode: "ignored"
      }
    ];
  }

  const url = query.startsWith("http") ? query : "https://" + query;

  try {
    const response = await axios.get(url, {
      headers: { "User-Agent": "FwebCrawler/1.0 (+https://fweb.africa)" },
      timeout: 10000
    });

    const html = response.data;
    const $ = cheerio.load(html);

    const title = $("title").first().text().trim() || "Untitled Page";

    let favicon =
      $('link[rel="icon"]').attr("href") ||
      $('link[rel="shortcut icon"]').attr("href") ||
      "/favicon.ico";

    if (favicon && !favicon.startsWith("http")) {
      try {
        const urlObj = new URL(url);
        favicon = new URL(favicon, urlObj.origin).href;
      } catch {
        favicon = null;
      }
    }

    let blocks = [];
    $("p, h1, h2, h3, h4, h5, h6, li").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 30) {
        blocks.push(text);
      }
    });

    const bodyText = $("body").text().trim();
    const bodyLength = bodyText.length;

    // ✅ Better detection
    if (blocks.length === 0 && bodyLength < 200) {
      return [
        {
          title,
          url,
          snippet: "This site appears JS-rendered, showing fCard instead.",
          favicon,
          blocks: [],
          html: null,
          mode: "fcards"
        }
      ];
    }

    // ✅ Static site → return full HTML
    return [
      {
        title,
        url,
        snippet: blocks[0] ? blocks[0].slice(0, 160) + "..." : "Loaded successfully.",
        favicon,
        blocks,
        html,
        mode: "browser"
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
          favicon: null,
          blocks: [],
          html: null,
          mode: "error"
        }
      ];
    }

    return [
      {
        title: "Crawl Failed",
        url,
        snippet: err.message,
        favicon: null,
        blocks: [],
        html: null,
        mode: "error"
      }
    ];
  }
}
