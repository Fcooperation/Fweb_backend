// fimages.js
import axios from "axios";
import * as cheerio from "cheerio";

/**
 * Fetch images based on a query.
 * @param {string} query - The search term
 * @returns {Promise<Array<{ url: string, thumbnail: string }>>}
 */
export async function fetchImages(query) {
  try {
    // Use DuckDuckGo image search (no API key needed)
    const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`;

    const { data } = await axios.get(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });

    const $ = cheerio.load(data);
    const results = [];

    $("img").each((i, el) => {
      const src = $(el).attr("src");
      if (src && src.startsWith("http")) {
        results.push({
          url: src,
          thumbnail: src,
        });
      }
    });

    // Limit results
    return results.slice(0, 20);
  } catch (err) {
    console.error("❌ fetchImages error:", err.message);
    return [];
  }
}
