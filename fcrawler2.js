// fcrawler2.js
import axios from "axios";
import * as cheerio from "cheerio";
import { TLDs } from "./tlds.js";

// --------------------
// Helpers
// --------------------
function normalizeForDomain(query) {
  return query.replace(/[^a-zA-Z0-9 ]/g, "");
}

// Fetch basic info from URL
async function fetchFcard(url, timeout = 5000) {
  try {
    const response = await axios.get(url, {
      headers: { "User-Agent": "FwebMini/1.0" },
      timeout
    });

    const $ = cheerio.load(response.data);

    // Snippet
    const snippet = $("p").first().text().trim().substring(0, 300) || "No snippet available";

    // Title fallback to domain if missing
    let title = $("title").first().text().trim();
    if (!title) {
      try {
        title = new URL(url).hostname;
      } catch {
        title = url;
      }
    }

    // Favicon: try multiple selectors
    let favicon =
      $('link[rel="icon"]').attr("href") ||
      $('link[rel="shortcut icon"]').attr("href") ||
      $('link[rel="apple-touch-icon"]').attr("href") ||
      "/favicon.ico";

    if (favicon && !favicon.startsWith("http")) {
      try {
        favicon = new URL(favicon, url).href;
      } catch {
        favicon = null;
      }
    }

    return { title, url, favicon, snippet };
  } catch (err) {
    // fallback for failed request
    try {
      const domain = new URL(url).hostname;
      return {
        title: domain,
        url,
        favicon: `/favicon.ico`,
        snippet: "Could not retrieve content"
      };
    } catch {
      return { title: url, url, favicon: null, snippet: "Could not retrieve content" };
    }
  }
}

// Generate URLs from TLDs
function generateTLDUrls(query) {
  const domainQuery = normalizeForDomain(query);
  return TLDs.map(tld => `https://${domainQuery}${tld}`);
}

// --------------------
// Main function
// --------------------
export async function handleNormalSearch(query) {
  const urls = generateTLDUrls(query);
  const fetchPromises = urls.map(url => fetchFcard(url, 4000));

  const results = await Promise.all(fetchPromises);

  // Ensure we always return at least one result
  if (results.length === 0) {
    return [
      {
        title: "No Results",
        url: null,
        favicon: null,
        snippet: "No fcards could be generated for this query."
      }
    ];
  }

  return results;
}
