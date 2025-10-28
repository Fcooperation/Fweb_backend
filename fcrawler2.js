// fcrawler2.js
import axios from "axios";
import * as cheerio from "cheerio";
import { TLDs } from "./tlds.js";

// --------------------
// Helpers
// --------------------
function normalizeForDomain(query) {
  return query.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

// Fast check if site exists
async function siteExists(url, timeout = 3000) {
  try {
    await axios.head(url, { timeout });
    return true;
  } catch {
    return false;
  }
}

// Fetch full fcard info
async function fetchFcard(url, timeout = 5000) {
  try {
    const response = await axios.get(url, {
      headers: { "User-Agent": "FwebMini/1.0" },
      timeout
    });

    const $ = cheerio.load(response.data);
    const snippet = $("p").first().text().trim().substring(0, 300) || "No snippet available";
    let title = $("title").first().text().trim() || new URL(url).hostname;

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
  } catch {
    return null;
  }
}

// Generate URLs for a word or combined query using all TLDs
function generateUrlsForWord(word) {
  const normalized = normalizeForDomain(word);
  return TLDs.map(tld => `https://${normalized}${tld}`);
}

// --------------------
// Main function
// --------------------
export async function handleNormalSearch(query) {
  const words = query.trim().split(/\s+/);

  // Step 1: combined query first
  const combined = words.join("");
  let combinedUrls = generateUrlsForWord(combined);

  // Step 2: separate words
  const singleWordUrls = words.flatMap(word => generateUrlsForWord(word));

  // Merge all URLs
  const allUrls = [...combinedUrls, ...singleWordUrls];

  // Remove duplicates
  const uniqueUrls = [...new Set(allUrls)];

  // ---------- Test all URLs simultaneously ----------
  const fetchPromises = uniqueUrls.map(async url => {
    if (await siteExists(url)) {
      return fetchFcard(url);
    }
    return null;
  });

  const resultsArr = await Promise.all(fetchPromises);
  const results = resultsArr.filter(r => r); // remove nulls

  if (results.length === 0) {
    return [{ title: "No Results", url: null, favicon: null, snippet: "No fcards could be generated." }];
  }

  return results;
}
