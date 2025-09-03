// fcrawler.js
import axios from "axios";
import * as cheerio from "cheerio";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { downloadImage } from "./utils.js"; // we'll define a helper to download images

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

  const url = query.startsWith("http") ? query : "https://" + query;

  try {
    const response = await axios.get(url, {
      headers: { "User-Agent": "FwebCrawler/1.0 (+https://fweb.africa)" },
      timeout: 10000
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Extract text blocks to check if JS-rendered
    let blocks = [];
    $("p, h1, h2, h3, h4, h5, h6, li").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 30) blocks.push(text);
    });

    // If JS-rendered, treat as normal search
    if (blocks.length === 0) {
      return [
        {
          title: "Normal Search (JS Site)",
          url,
          snippet: "This site seems JS-rendered; treated as a normal search query.",
          html: null,
          type: "normalSearch"
        }
      ];
    }

    // --- REWRITE LINKS to open in frontend ---
    $("a").each((_, el) => {
      const href = $(el).attr("href");
      if (href) {
        try {
          const absoluteUrl = new URL(href, url).href;
          // Rewrite link to open inside frontend search
          $(el).attr("href", `javascript:performSearch('${absoluteUrl}')`);
          $(el).attr("target", "_self");
        } catch {}
      }
    });

    // --- DOWNLOAD & REWRITE IMAGE SRC ---
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    $("img").each((_, el) => {
      let src = $(el).attr("src");
      if (src) {
        try {
          const absoluteSrc = new URL(src, url).href;
          const localFileName = path.basename(new URL(src, url).pathname);
          const localPath = path.join(__dirname, "public", "images", localFileName);

          // Ensure the images folder exists
          fs.mkdirSync(path.dirname(localPath), { recursive: true });

          // Download image
          downloadImage(absoluteSrc, localPath);

          // Rewrite src to local path
          $(el).attr("src", `/images/${localFileName}`);
        } catch {}
      }
    });

    const fixedHtml = $.html();

    return [
      {
        title: "Done Crawling",
        url,
        snippet: `Captured ${blocks.length} content blocks from the page.`,
        html: fixedHtml,
        type: "static"
      }
    ];
  } catch (err) {
    console.error("❌ Crawl error:", err.message);

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
