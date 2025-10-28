// fcrawler2.js
import axios from "axios";
import * as cheerio from "cheerio";
import { TLDs } from "./tlds.js"; // your full list (100+)

// --------------------
// Config
// --------------------
const TOP_TLD_COUNT = 30;   // first N TLDs to try immediately
const BATCH_SIZE = 30;      // how many TLD requests to run in parallel for the fallback stage
const REQUEST_TIMEOUT = 7000;

// --------------------
// Helpers
// --------------------
function normalizeForDomain(query) {
  return query.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

// Robust fetch that follows redirects and returns final URL, title, snippet
async function fetchFcard(url, timeout = REQUEST_TIMEOUT) {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      timeout,
      maxRedirects: 5,
      validateStatus: status => status >= 200 && status < 400
    });

    // best-effort final URL
    const finalUrl =
      (response.request && response.request.res && response.request.res.responseUrl) ||
      response.config?.url ||
      url;

    const $ = cheerio.load(response.data);
    const snippet = $("p").first().text().trim().substring(0, 300) || "No snippet available";
    const title = $("title").first().text().trim() || new URL(finalUrl).hostname;

    return { title, url: finalUrl, snippet };
  } catch (err) {
    // silent skip on failure (could log err.message for debugging)
    return null;
  }
}

// Generate full url string for a domain name + tld (https)
function makeUrl(domain, tld) {
  return `https://${domain}${tld}`;
}

// chunk array into batches of size n
function chunkArray(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// Run a list of urls in parallel and return successful fcards
async function fetchUrlsInParallel(urls) {
  const promises = urls.map(u => fetchFcard(u));
  const resultsArr = await Promise.all(promises);
  return resultsArr.filter(r => r);
}

// --------------------
// Core logic
// --------------------
export async function handleNormalSearch(query) {
  const rawWords = (query || "").trim().split(/\s+/).filter(Boolean);
  if (!rawWords.length) {
    return [
      { title: "Invalid Query", url: null, snippet: "Your query must contain letters or numbers." }
    ];
  }

  // words to test: combined + each individual word
  const combined = rawWords.join("");
  const wordsToTest = [combined, ...rawWords];

  // normalize domains
  const normalizedWords = [...new Set(wordsToTest.map(w => normalizeForDomain(w)).filter(Boolean))];

  // get top and remaining TLD lists from tlds.js
  const topTLDs = TLDs.slice(0, TOP_TLD_COUNT);
  const remainingTLDs = TLDs.slice(TOP_TLD_COUNT);

  // 1) Prepare URLs for top TLDs for all words (parallel across all those URLs)
  const topUrls = [];
  for (const w of normalizedWords) {
    for (const tld of topTLDs) topUrls.push(makeUrl(w, tld));
  }

  // Fetch all top URLs in parallel
  const topResults = await fetchUrlsInParallel(topUrls);

  // Collect results and track which normalized words already produced at least one result
  const seenHostnames = new Set();
  const seenTitles = new Set();
  const finalResults = [];

  // helper to add unique result
  function tryAddResult(r) {
    try {
      const hostname = new URL(r.url).hostname;
      const titleKey = (r.title || "").toLowerCase();
      if (!seenHostnames.has(hostname) && !seenTitles.has(titleKey)) {
        seenHostnames.add(hostname);
        seenTitles.add(titleKey);
        finalResults.push(r);
        return true;
      }
    } catch {
      // ignore malformed URL
    }
    return false;
  }

  // add topResults in order (top-level)
  for (const r of topResults) tryAddResult(r);

  // Determine which normalized words still need fallback testing (no result found for them)
  const wordsNeedingFallback = [];
  for (const w of normalizedWords) {
    // check if any existing finalResults hostname contains the word (best-effort)
    const matched = Array.from(seenHostnames).some(h => h.includes(w));
    if (!matched) wordsNeedingFallback.push(w);
  }

  // 2) If some words have no top-TLD results, test remaining TLDs in batches (across all needed words)
  if (wordsNeedingFallback.length > 0 && remainingTLDs.length > 0) {
    // Build all fallback URLs for words needing fallback
    const fallbackUrls = [];
    for (const w of wordsNeedingFallback) {
      for (const tld of remainingTLDs) fallbackUrls.push(makeUrl(w, tld));
    }

    // Break into batches to avoid blasting too many requests at once
    const batches = chunkArray(fallbackUrls, BATCH_SIZE);

    for (const batch of batches) {
      const batchResults = await fetchUrlsInParallel(batch);
      for (const r of batchResults) tryAddResult(r);

      // Optional: small pause between batches to be gentle (commented out by default)
      // await new Promise(resolve => setTimeout(resolve, 100)); // 100ms
    }
  }

  // Final fallback: if still no results (very unlikely), return No Results
  if (finalResults.length === 0) {
    return [
      { title: "No Results", url: null, snippet: `No fcards found for "${query}" on tested TLDs.` }
    ];
  }

  return finalResults;
}
