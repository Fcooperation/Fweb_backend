import axios from "axios";
import * as cheerio from "cheerio";
import { TLDs } from "./tlds.js";
import { sourceCategories } from "./sites.js";
import { definitionWords } from "./definitionWords.js";

// --------------------
// Helpers
// --------------------
function normalizeForDomain(query) {
  return query.replace(/[^a-zA-Z0-9]/g, "");
}

// Normalize query for Wikipedia titles (capitalize words, replace spaces)
function normalizeForWikipedia(query) {
  const stripped = stripDefinitionWords(query);
  return stripped
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join("_");
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
// Fetch fcards from a list of sources
// --------------------
async function fetchFcardsFromSources(query, sources) {
  const promises = sources.map(async buildUrl => {
    const url = buildUrl(query);
    try {
      const response = await axios.get(url, {
        headers: { "User-Agent": "FwebFcards/1.0 (+https://fweb.africa)" },
        timeout: 5000
      });

      const $ = cheerio.load(response.data);
      const snippet = $("p").first().text().trim().substring(0, 200);
      if (!snippet) return null;

      const title = $("title").first().text().trim() || url;
      let favicon = $('link[rel="icon"]').attr("href") || $('link[rel="shortcut icon"]').attr("href") || "/favicon.ico";
      if (favicon && !favicon.startsWith("http")) favicon = new URL(favicon, url).href;

      return { title, url, favicon, snippet, type: "fcards" };
    } catch {
      return null;
    }
  });

  const results = await Promise.allSettled(promises);
  return results.filter(r => r.status === "fulfilled" && r.value).map(r => r.value);
}

// --------------------
// TLD fcards (multi-word with first-word priority)
// --------------------
async function tryMultiWordTLDs(query) {
  const words = query.trim().split(/\s+/);
  let results = [];

  if (words.length === 1) {
    results = await tryOfficialDomains(words[0]);
  } else {
    // First word fcards
    const firstWordFcards = await tryOfficialDomains(words[0]);

    // Combined words fcards
    const combinedWord = normalizeForDomain(words.join(""));
    const combinedFcards = await tryOfficialDomains(combinedWord);

    results = [...firstWordFcards, ...combinedFcards];
  }

  return results;
}

// --------------------
// Single-word or multi-word TLD fetch
// --------------------
async function tryOfficialDomains(baseQuery) {
  const domainQuery = normalizeForDomain(baseQuery);
  const promises = TLDs.map(async tld => {
    const url = `https://${domainQuery}${tld}`;
    try {
      const response = await axios.get(url, {
        headers: { "User-Agent": "FwebFcards/1.0 (+https://fweb.africa)" },
        timeout: 4000
      });
      const $ = cheerio.load(response.data);
      const title = $("title").first().text().trim() || url;
      const snippet = $("p").first().text().trim().substring(0, 200) || `Official site for ${baseQuery}`;
      const favicon = `https://www.google.com/s2/favicons?sz=64&domain_url=${url}`;
      return { title, url, favicon, snippet, type: "fcards" };
    } catch {
      return null;
    }
  });

  const results = await Promise.allSettled(promises);
  return results.filter(r => r.status === "fulfilled" && r.value).map(r => r.value);
}

// --------------------
// Unified fcard generation
// --------------------
export async function handleNormalSearch(query) {
  const definitionQuery = isDefinitionQuery(query);
  const strippedQuery = stripDefinitionWords(query);

  // --------------------
  // Prepare fetches
  // --------------------
  const wikiQuery = normalizeForWikipedia(query);
  const knowledgeSources = Object.values(sourceCategories).flat();

  const fetches = [
    definitionQuery ? fetchFcardsFromSources(wikiQuery, knowledgeSources) : Promise.resolve([]),
    tryMultiWordTLDs(strippedQuery)
  ];

  // Run everything in parallel
  const [knowledgeFcards, tldFcards] = await Promise.all(fetches);

  // --------------------
  // Combine results
  // --------------------
  const results = [...knowledgeFcards, ...tldFcards];

  // --------------------
  // Fallback if nothing found
  // --------------------
  if (results.length === 0) {
    return [{
      title: "No Results",
      url: null,
      snippet: "No fcards could be generated for this query.",
      type: "fcards-empty"
    }];
  }

  return results;
}
