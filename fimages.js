// fimages.js
import axios from "axios";

export async function fetchImages(query) {
  if (!query) return [];

  try {
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2`;

    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
      },
    });

    // Extract image URLs with regex (Bing hides them in "murl":"...jpg")
    const matches = [...response.data.matchAll(/"murl":"(.*?)"/g)];
    const results = matches.map((m) => ({
      url: m[1],
      thumbnail: m[1], // Could improve by scraping thumbnails too
      source: `https://www.bing.com/images/search?q=${encodeURIComponent(query)}`,
    }));

    return results.slice(0, 20); // Limit to first 20
  } catch (err) {
    console.error("❌ Bing image fetch failed:", err.message);
    return [];
  }
}
