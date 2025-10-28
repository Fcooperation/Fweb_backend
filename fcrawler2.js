// fcrawler2.js
import axios from "axios";
import * as cheerio from "cheerio";
import { definitionWords } from "./definitionWords.js";
import { sourceCategories } from "./sites.js";

// --------------------
// Config
// --------------------
const COMMON_TLDS = [
  ".com", ".net", ".org", ".io", ".co", ".us", ".info", ".biz", ".online", ".tech",
  ".app", ".site", ".xyz", ".ai", ".me", ".store", ".space", ".tv", ".dev", ".uk",
  ".in", ".de", ".ca", ".fr", ".au", ".nl", ".jp", ".es", ".se", ".ch"
];
const REQUEST_TIMEOUT = 7000;

// --------------------
// Helpers
// --------------------
function normalizeForDomain(query) {
  return query.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function startsWithDefinitionWord(query) {
  const lower = query.toLowerCase().trim();
  return definitionWords.some(prefix => lower.startsWith(prefix));
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
      (response.request?.res?.responseUrl) || response.config?.url || url;
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

async function fetchUrlsInParallel(urls) {
  const results = await Promise.all(urls.map(fetchFcard));
  return results.filter(r => r);
}

async function fetchFromSites(query) {
  const results = [];
  const seen = new Set();
  const sitesFns = Object.values(sourceCategories).flat().filter(fn => typeof fn === "function");

  const urls = sitesFns.map(fn => fn(query)).filter(Boolean);
  const fetched = await fetchUrlsInParallel(urls);

  for (const r of fetched) {
    if (!seen.has(r.url)) {
      seen.add(r.url);
      results.push(r);
    }
  }

  return results;
}

// --------------------
// Main logic
// --------------------
export async function handleNormalSearch(query) {
  const cleaned = query.trim();
  if (!cleaned) {
    return [{ title: "Invalid Query", url: null, snippet: "Your query must contain letters or numbers." }];
  }

  const isDefinition = startsWithDefinitionWord(cleaned);
  const normalized = normalizeForDomain(cleaned);

  let tldWord = normalized;
  if (isDefinition) {
    // Extract last important word (e.g. "what is a cat" → "cat")
    const parts = cleaned.toLowerCase().split(/\s+/);
    tldWord = normalizeForDomain(parts[parts.length - 1]);
  }

  // ------------------
  // Step 1: TLD search
  // ------------------
  const tldUrls = COMMON_TLDS.map(tld => makeUrl(tldWord, tld));
  const tldPromise = fetchUrlsInParallel(tldUrls);

  // ------------------
  // Step 2: Site search
  // ------------------
  const sitesPromise = fetchFromSites(cleaned);

  // Run both in parallel
  const [tldResults, siteResults] = await Promise.all([tldPromise, sitesPromise]);

  // Deduplicate results
  const seen = new Set();
  const allResults = [];

  const addUnique = (arr) => {
    for (const r of arr) {
      if (r && !seen.has(r.url)) {
        seen.add(r.url);
        allResults.push(r);
      }
    }
  };

  if (isDefinition) {
    // Definition first: Britannica/Wiki first, then domains
    addUnique(siteResults);
    addUnique(tldResults);
  } else {
    // Normal: domains first, then site references
    addUnique(tldResults);
    addUnique(siteResults);
  }

  if (allResults.length === 0) {
    return [{ title: "No Results", url: null, snippet: `No results found for "${query}".` }];
  }

  return allResults;
}
