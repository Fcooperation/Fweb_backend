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

function normalizeForWikipedia(query) {
  const stripped = stripDefinitionWords(query);
  return stripped
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function isDefinitionQuery(query) {
  const lower = query.toLowerCase();
  return definitionWords.some(trigger => lower.startsWith(trigger));
}

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
async function fetchFcard(url) {
  try {
    const response = await axios.get(url, {
      headers: { "User-Agent": "FwebFcards/1.0 (+https://fweb.africa)" },
      timeout: 5000
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
function mergeAndScoreFcards(fcards, wikiQuery, knowledgeSources, userQuery) {
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
      if (knowledgeSources.some(src => fcard.url.includes(src(wikiQuery).replace(/https?:\/\//, "")))) score = 3;
      else if (TLDs.some(tld => fcard.url.endsWith(tld))) score = 2;

      seen.set(fcard.url, { ...fcard, snippet: highlightedSnippet, score });
    }
  });

  return Array.from(seen.values()).sort(
    (a, b) => b.score - a.score || b.snippet.length - a.snippet.length
  );
}

// --------------------
// Unified fcard generation
// --------------------
export async function handleNormalSearch(query) {
  const definitionQuery = isDefinitionQuery(query);
  const wikiQuery = normalizeForWikipedia(query);
  const fullQuery = query;
  const knowledgeSources = Object.values(sourceCategories).flat();

  // --------------------
  // Build all URLs for parallel fetch
  // --------------------
  const allUrls = [];

  // TLDs: full query
  generateTLDUrls(fullQuery).forEach(url => allUrls.push(url));

  // TLDs: first word if multi-word
  const words = fullQuery.trim().split(/\s+/);
  if (words.length > 1) generateTLDUrls(words[0]).forEach(url => allUrls.push(url));

  // Sites.js sources: full query (important for definitions)
  knowledgeSources.forEach(buildUrl => allUrls.push(buildUrl(fullQuery)));

  // Knowledge sources: wikiQuery if definitionQuery
  if (definitionQuery) knowledgeSources.forEach(buildUrl => allUrls.push(buildUrl(wikiQuery)));

  // --------------------
  // Fetch all URLs in parallel
  // --------------------
  const fetchPromises = allUrls.map(url => fetchFcard(url));
  let resultsArr = await Promise.allSettled(fetchPromises);
  let results = resultsArr.filter(r => r.status === "fulfilled" && r.value).map(r => r.value);

  // --------------------
  // Fallback for non-def queries: try wiki/definition sources if empty
  // --------------------
  if (results.length === 0 && !definitionQuery) {
    const defUrls = knowledgeSources.map(buildUrl => buildUrl(wikiQuery));
    const defFetchPromises = defUrls.map(url => fetchFcard(url));
    const defResultsArr = await Promise.allSettled(defFetchPromises);
    const defResults = defResultsArr.filter(r => r.status === "fulfilled" && r.value).map(r => r.value);
    results = defResults;
  }

  // --------------------
  // Merge, deduplicate, score & highlight
  // --------------------
  const finalFcards = mergeAndScoreFcards(results, wikiQuery, knowledgeSources, query);

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
