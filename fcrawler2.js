import axios from "axios";
import * as cheerio from "cheerio";
import { TLDs } from "./tlds.js";
import { sourceCategories } from "./sites.js";
import { definitionWords } from "./definitionWords.js";

// --------------------
// Helpers
// --------------------
function normalizeForDomain(query) {
  return query.replace(/[^a-zA-Z0-9 ]/g, "");
}

function isDefinitionQuery(query) {
  const lower = query.toLowerCase();
  return definitionWords.some(trigger => lower.startsWith(trigger));
}

// Keep full query for Wikipedia; we don't strip def words here
function stripDefinitionWords(query) {
  let result = query.toLowerCase();
  for (const trigger of definitionWords) {
    if (result.startsWith(trigger)) {
      result = result.replace(trigger, "").trim();
      break;
    }
  }
  return result || query;
}

// --------------------
// Fetch fcard from URL
// --------------------
async function fetchFcard(url, timeout = 5000) {
  try {
    const response = await axios.get(url, {
      headers: { "User-Agent": "FwebFcards/1.0 (+https://fweb.africa)" },
      timeout
    });

    const $ = cheerio.load(response.data);
    const snippet = $("p").first().text().trim().substring(0, 300);
    if (!snippet) return null;

    const title = $("title").first().text().trim() || url;
    let favicon =
      $('link[rel="icon"]').attr("href") ||
      $('link[rel="shortcut icon"]').attr("href") ||
      "/favicon.ico";
    if (favicon && !favicon.startsWith("http")) favicon = new URL(favicon, url).href;

    return { title, url, favicon, snippet, type: "fcards" };
  } catch {
    return null;
  }
}

// --------------------
// Generate TLD URLs
// --------------------
function generateTLDUrls(query) {
  const domainQuery = normalizeForDomain(query);
  return TLDs.map(tld => `https://${domainQuery}${tld}`);
}

// --------------------
// Merge, score & highlight fcards
// --------------------
function mergeAndScoreFcards(fcards, knowledgeSources, userQuery) {
  const seen = new Map();
  const queryWords = userQuery
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.toLowerCase());

  const highlightSnippet = snippet => {
    let highlighted = snippet;
    queryWords.forEach(word => {
      const regex = new RegExp(`(${word})`, "gi");
      highlighted = highlighted.replace(regex, '<mark>$1</mark>');
    });
    return highlighted;
  };

  fcards.forEach(fcard => {
    const highlightedSnippet = highlightSnippet(fcard.snippet);
    if (seen.has(fcard.url)) {
      seen.get(fcard.url).snippet += " " + highlightedSnippet;
    } else {
      let score = 1;
      if (fcard.url.includes("wikipedia.org")) score = 5;
      else if (fcard.url.includes("collinsdictionary.com")) score = 4;
      else if (fcard.url.includes("britannica.com")) score = 3;
      else if (knowledgeSources.some(src => fcard.url.includes(src(userQuery).replace(/https?:\/\//, "")))) score = 2;
      else if (TLDs.some(tld => fcard.url.endsWith(tld))) score = 1;

      seen.set(fcard.url, { ...fcard, snippet: highlightedSnippet, score });
    }
  });

  return Array.from(seen.values()).sort(
    (a, b) => b.score - a.score || b.snippet.length - a.snippet.length
  );
}

// --------------------
// Wikipedia URL (full query, keep def words)
// --------------------
function buildWikipediaUrlFullQuery(query) {
  const capitalized = query.charAt(0).toUpperCase() + query.slice(1);
  const wikiPath = capitalized.replace(/ /g, "_");
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiPath)}`;
}

// --------------------
// Collins Dictionary URL
// --------------------
function buildCollinsUrl(query) {
  const normalized = normalizeForDomain(query).replace(/ /g, "-");
  return `https://www.collinsdictionary.com/dictionary/english/${encodeURIComponent(normalized)}`;
}

// --------------------
// Britannica URL
// --------------------
function buildBritannicaUrl(query) {
  const normalized = query.split(/\s+/).join("_");
  return `https://www.britannica.com/search?query=${encodeURIComponent(normalized)}`;
}

// --------------------
// Unified fcard generation
// --------------------
export async function handleNormalSearch(query) {
  const definitionQuery = isDefinitionQuery(query);
  const knowledgeSources = Object.values(sourceCategories).flat();
  const fullQuery = query;

  let fetchPromises = [];

  if (definitionQuery) {
    // Definition query: Wikipedia → Collins → Britannica → other sites.js
    const priorityUrls = [
      buildWikipediaUrlFullQuery(fullQuery),
      buildCollinsUrl(fullQuery),
      buildBritannicaUrl(fullQuery),
      ...knowledgeSources.map(fn => fn(fullQuery))
    ];
    fetchPromises = priorityUrls.map(url => fetchFcard(url, 4000));
  } else {
    // Non-definition: TLDs first
    let tldUrls = generateTLDUrls(fullQuery);
    if (fullQuery.split(" ").length > 1) tldUrls = [...tldUrls, ...generateTLDUrls(fullQuery.split(" ")[0])];
    fetchPromises = tldUrls.map(url => fetchFcard(url, 4000));
  }

  // --------------------
  // Fetch all URLs in parallel
  // --------------------
  let resultsArr = await Promise.allSettled(fetchPromises);
  let results = resultsArr.filter(r => r.status === "fulfilled" && r.value).map(r => r.value);

  // --------------------
  // Fallback for non-def queries → sites.js
  // --------------------
  if (!definitionQuery && results.length === 0) {
    const siteUrls = knowledgeSources.map(fn => fn(fullQuery));
    const fallbackArr = await Promise.allSettled(siteUrls.map(url => fetchFcard(url, 5000)));
    const fallbackResults = fallbackArr.filter(r => r.status === "fulfilled" && r.value).map(r => r.value);
    results = fallbackResults;
  }

  // --------------------
  // Merge, deduplicate, score & highlight
  // --------------------
  const finalFcards = mergeAndScoreFcards(results, knowledgeSources, query);

  if (finalFcards.length === 0) {
    return [{
      title: "No Results",
      url: null,
      snippet: "No fcards could be generated for this query.",
      type: "fcards-empty"
    }];
  }

  return finalFcards;
}
