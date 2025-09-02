import axios from "axios";
import * as cheerio from "cheerio";

// Run fcards logic for JS-rendered sites
export async function runFcards(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "FwebFcards/1.0 (+https://fweb.africa)"
      },
      timeout: 10000
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Extract site favicon
    let favicon =
      $('link[rel="icon"]').attr("href") ||
      $('link[rel="shortcut icon"]').attr("href") ||
      "/favicon.ico";

    if (favicon && !favicon.startsWith("http")) {
      favicon = new URL(favicon, url).href;
    }

    // Extract links in order
    let cards = [];
    $("a").each((_, el) => {
      const href = $(el).attr("href");
      const text = $(el).text().trim();

      if (href && text) {
        let absoluteUrl;
        try {
          absoluteUrl = new URL(href, url).href; // resolve relative URLs
        } catch {
          return;
        }

        cards.push({
          title: text.length > 80 ? text.substring(0, 77) + "..." : text,
          url: absoluteUrl,
          favicon
        });
      }
    });

    return [
      {
        title: "JS Rendered Links",
        url,
        snippet: `Extracted ${cards.length} links.`,
        cards,
        type: "jsRendered"
      }
    ];
  } catch (err) {
    console.error("❌ fcards error:", err.message);
    return [
      {
        title: "Fcards Failed",
        url,
        snippet: err.message,
        cards: [],
        type: "error"
      }
    ];
  }
}
