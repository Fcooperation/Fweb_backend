// fcrawler2.js
import axios from "axios";
import * as cheerio from "cheerio";
import { TLDs } from "./tlds.js";
import { definitionWords } from "./definitionWords.js";
import { sourceCategories } from "./sites.js";

// --------------------
// Config
// --------------------
const TOP_TLD_COUNT = 30;
const BATCH_SIZE = 30;
const REQUEST_TIMEOUT = 7000;

// --------------------
// Helpers
// --------------------
function normalizeForDomain(query) {
  return query.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

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

    const finalUrl =
      response.request?.res?.responseUrl || response.config?.url || url;

    const $ = cheerio.load(response.data);
    const snippet = $("p").first().text().trim().substring(0, 300) || "No snippet available";
    const title = $("title").first().text().trim() || new URL(finalUrl).hostname;

    return { title, url: finalUrl, snippet };
  } catch {
    return null;
  }
}

function makeUrl(domain, tld) {
  return `https://${domain}${tld}`;
}

function chunkArray(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function fetchUrlsInParallel(urls) {
  const results = await Promise.all(urls.map(u => fetchFcard(u)));
  return results.filter(r => r);
}

// --------------------
// Sites.js generator
// --------------------
function generateSiteUrls(query) {
  const urls = [];
  for (const key of Object.keys(sourceCategories)) {
    for (const fn of sourceCategories[key]) {
      try {
        const siteUrl = fn(query);
        if (siteUrl) urls.push(siteUrl);
      } catch {}
    }
  }
  return urls;
}

// --------------------
// Main logic
// --------------------
export async function handleNormalSearch(query) {
  const raw = (query || "").trim().toLowerCase();
  if (!raw) {
    return [
      { title: "Invalid Query", url: null, snippet: "Your query must contain letters or numbers." }
    ];
  }

  // --- Detect if query starts with a definition word ---
  const defWord = definitionWords.find(w => raw.startsWith(w.toLowerCase()));
  let isDef = false;
  let cleanQuery = raw;
  if (defWord) {
    isDef = true;
    cleanQuery = raw.replace(defWord, "").trim(); // remove the def prefix
  }

  const words = cleanQuery.split(/\s+/);
  const combined = words.join("");
  const normalizedWords = [...new Set([combined, ...words].map(normalizeForDomain))];

  // --- Get TLD lists ---
  const topTLDs = TLDs.slice(0, TOP_TLD_COUNT);
  const remainingTLDs = TLDs.slice(TOP_TLD_COUNT);

  const seenHostnames = new Set();
  const seenTitles = new Set();
  const finalResults = [];
  const tryAdd = (r) => {
    try {
      const hostname = new URL(r.url).hostname;
      const titleKey = (r.title || "").toLowerCase();
      if (!seenHostnames.has(hostname) && !seenTitles.has(titleKey)) {
        seenHostnames.add(hostname);
        seenTitles.add(titleKey);
        finalResults.push(r);
      }
    } catch {}
  };

  // --- Case 1: Definition Query ---
  if (isDef) {
    // a) Definition sites (Britannica, Wikipedia, etc.)
    const defUrls = generateSiteUrls(query); // use full "what is a cat"
    const defResults = await fetchUrlsInParallel(defUrls);
    defResults.forEach(tryAdd);

    // b) TLDs on cleaned keyword only ("cat")
    const tldUrls = [];
    for (const w of normalizedWords) {
      for (const tld of topTLDs) tldUrls.push(makeUrl(w, tld));
    }
    const tldResults = await fetchUrlsInParallel(tldUrls);
    tldResults.forEach(tryAdd);
  }

  // --- Case 2: Normal Query ---
  else {
    // a) TLDs (like render.com etc.)
    const tldUrls = [];
    for (const w of normalizedWords) {
      for (const tld of topTLDs) tldUrls.push(makeUrl(w, tld));
    }
    const tldResults = await fetchUrlsInParallel(tldUrls);
    tldResults.forEach(tryAdd);

    // b) Sites.js sources (render from TechCrunch, etc.)
    const siteUrls = generateSiteUrls(query);
    const siteResults = await fetchUrlsInParallel(siteUrls);
    siteResults.forEach(tryAdd);
  }

  // --- Handle empty results ---
  if (finalResults.length === 0) {
    return [
      { title: "No Results", url: null, snippet: `No fcards found for "${query}" on tested sources.` }
    ];
  }

  return finalResults;
}
