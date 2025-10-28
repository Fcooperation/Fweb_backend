// fcrawler2.js
import axios from "axios";
import * as cheerio from "cheerio";
import { TLDs } from "./tlds.js";
import { sourceCategories } from "./sites.js";

// --------------------
// Helpers
// --------------------
function normalizeForDomain(query) {
  return query.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

// Fast check if site exists (HEAD request)
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

// --------------------
// Main function
// --------------------
export async function handleNormalSearch(query) {
  const words = query.trim().split(/\s+/);
  const combined = normalizeForDomain(query);

  const first10TLDs = TLDs.slice(0, 10);
  const remainingTLDs = TLDs.slice(10);

  let results = [];

  // ---------- Step 1: combined domain + first 10 TLDs ----------
  for (const tld of first10TLDs) {
    const url = `https://${combined}${tld}`;
    if (await siteExists(url)) {
      const fcard = await fetchFcard(url);
      if (fcard) results.push(fcard);
    }
  }

  // ---------- Step 2: single words using sites.js ----------
  const sitesFns = Object.values(sourceCategories)
    .flat()                        // flatten nested arrays
    .filter(fn => typeof fn === "function"); // keep only functions

  for (const word of words) {
    for (const fn of sitesFns) {
      const url = fn(word);
      if (url && await siteExists(url)) {
        const fcard = await fetchFcard(url);
        if (fcard) results.push(fcard);
      }
    }
  }

  // ---------- Step 3: remaining TLDs for combined domain ----------
  for (const tld of remainingTLDs) {
    const url = `https://${combined}${tld}`;
    if (await siteExists(url)) {
      const fcard = await fetchFcard(url);
      if (fcard) results.push(fcard);
    }
  }

  // Remove duplicates by URL
  const seen = new Map();
  for (const f of results) {
    if (!seen.has(f.url)) seen.set(f.url, f);
  }

  if (seen.size === 0) {
    return [{ title: "No Results", url: null, favicon: null, snippet: "No fcards could be generated." }];
  }

  return Array.from(seen.values());
}
