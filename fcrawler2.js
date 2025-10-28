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
    const snippet = $("p").first().text().trim().substring(0, 300) || "No snippet available";
    const title = $("title").first().text().trim() || url;
    let favicon = $('link[rel="icon"]').attr("href") || "/favicon.ico";
    if (favicon && !favicon.startsWith("http")) favicon = new URL(favicon, url).href;

    return { title, url, favicon, snippet };
  } catch {
    return { title: "Failed to fetch", url, favicon: null, snippet: "Could not retrieve content" };
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
