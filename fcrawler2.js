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

// Generate URLs for a word using top TLDs first
function generateUrlsForWord(word) {
  const normalized = normalizeForDomain(word);
  const first10 = TLDs.slice(0, 10).map(tld => `https://${normalized}${tld}`);
  const remaining = TLDs.slice(10).map(tld => `https://${normalized}${tld}`);
  return [...first10, ...remaining];
}

// --------------------
// Main function
// --------------------
export async function handleNormalSearch(query) {
  const words = query.trim().split(/\s+/);
  const combined = words.join("");

  // Step 1: combined query first
  const combinedUrls = generateUrlsForWord(combined);

  // Step 2: separate words
  const singleWordUrls = words.flatMap(word => generateUrlsForWord(word));

  // Merge all URLs and remove duplicates
  const allUrls = [...new Set([...combinedUrls, ...singleWordUrls])];

  // ---------- Fetch all URLs simultaneously ----------
  const fetchPromises = allUrls.map(url => fetchFcard(url));
  const resultsArr = await Promise.all(fetchPromises);

  // Filter out nulls (non-existent domains)
  const results = resultsArr.filter(r => r);

  if (results.length === 0) {
    return [{ title: "No Results", url: null, favicon: null, snippet: "No fcards could be generated." }];
  }

  return results;
}
