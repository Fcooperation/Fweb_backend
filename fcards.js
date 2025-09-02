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

    // Normalize favicon URL
    if (favicon && !favicon.startsWith("http")) {
      favicon = new URL(favicon, url).href;
    }

    // Extract links and build fcards directly
    let cardsHTML = "";
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

        const safeTitle = text.length > 80 ? text.substring(0, 77) + "..." : text;

        // ✅ Build fcard HTML directly
        cardsHTML += `
          <a href="${absoluteUrl}" target="_blank" class="fcard">
            <img src="${favicon}" class="favicon" onerror="this.style.display='none'"/>
            <span>${safeTitle}</span>
          </a>
        `;
      }
    });

    if (!cardsHTML) {
      return [
        {
          title: "JS Site Detected",
          url,
          snippet: "No links could be extracted from this JavaScript-rendered site.",
          html: `<div class="fcard blocked">No links found.</div>`,
          type: "jsRendered-empty"
        }
      ];
    }

    // ✅ Return one object with HTML ready to drop into frontend
    return [
      {
        title: "JS Rendered Fcards",
        url,
        snippet: "Links extracted and built into fcards.",
        html: `<div class="fcards">${cardsHTML}</div>`,
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
        html: `<div class="fcard blocked">Error: ${err.message}</div>`,
        type: "error"
      }
    ];
  }
}
