// fcrawler2.js
import axios from "axios";
import * as cheerio from "cheerio";
import { TLDs } from "./TLDs.js";
import { sourceCategories } from "./sites.js";
import { definitionWords } from "./definitionWords.js";

// --------------------
// Helper: Normalize query
// --------------------
function normalizeForDomain(query) {
  return query.replace(/[^a-zA-Z0-9]/g, "");
}

// --------------------
// Check if query contains definition words
// --------------------
function isDefinitionQuery(query) {
  const lower = query.toLowerCase();
  return definitionWords.some(trigger => lower.startsWith(trigger));
}

// --------------------
// Strip definition words from query for TLDs
// --------------------
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
// Knowledge / definition sources (~20 sites)
// --------------------
const knowledgeSites = [
  "https://en.wikipedia.org",
  "https://www.britannica.com",
  "https://www.encyclopedia.com",
  "https://www.howstuffworks.com",
  "https://www.investopedia.com",
  "https://www.dictionary.com",
  "https://www.merriam-webster.com",
  "https://www.thoughtco.com",
  "https://www.sciencedirect.com",
  "https://plato.stanford.edu",
  "https://www.khanacademy.org",
  "https://www.quora.com",
  "https://simple.wikipedia.org",
  "https://www.worldatlas.com",
  "https://www.healthline.com",
  "https://www.webmd.com",
  "https://kids.britannica.com",
  "https://www.nationalgeographic.com",
  "https://www.techopedia.com",
  "https://dictionary.cambridge.org"
];

// --------------------
// Fetch knowledge fcards
// --------------------
async function handleKnowledgeSources(query) {
  const promises = knowledgeSites.map(async (site) => {
    try {
      const url = `${site}/wiki/${encodeURIComponent(query)}`;
      const response = await axios.get(url, {
        headers: { "User-Agent": "FwebFcards/1.0 (+https://fweb.africa)" },
        timeout: 4000
      });
      const $ = cheerio.load(response.data);
      const snippet = $("p").first().text().trim().substring(0, 200);
      if (!snippet) return null;
      const title = $("title").first().text().trim() || site;
      const favicon = `https://www.google.com/s2/favicons?sz=64&domain_url=${site}`;
      return { title, url, favicon, snippet, type: "fcards" };
    } catch {
      return null;
    }
  });

  const results = await Promise.allSettled(promises);
  return results.filter(r => r.status === "fulfilled" && r.value).map(r => r.value);
}

// --------------------
// TLD fcards
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
// Category source fcards
// --------------------
async function crawlSources(query, categories) {
  const selectedSources = categories.flatMap(cat => sourceCategories[cat] || []);
  const promises = selectedSources.map(async buildUrl => {
    const url = buildUrl(query);
    try {
      const response = await axios.get(url, {
        headers: { "User-Agent": "FwebFcards/1.0 (+https://fweb.africa)" },
        timeout: 6000
      });
      const $ = cheerio.load(response.data);
      const title = $("title").first().text().trim() || url;
      const snippet = $("p").first().text().trim().substring(0, 200) || "No snippet available.";
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
// Generate Fcards (Definition + TLD + Combined)
// --------------------
async function generateFcards(query) {
  let results = [];

  // Step 1: Knowledge sources (definition triggers)
  if (isDefinitionQuery(query)) {
    const knowledgeFcards = await handleKnowledgeSources(query);
    results.push(...knowledgeFcards);
  }

  // Step 2: TLDs
  const cleanedQuery = stripDefinitionWords(query);
  const words = cleanedQuery.trim().split(/\s+/);

  if (words.length === 1) {
    const tldFcards = await tryOfficialDomains(words[0]);
    results.push(...tldFcards);
  } else {
    // Multi-word: first word then combined
    const firstWordFcards = await tryOfficialDomains(words[0]);
    const combinedWord = normalizeForDomain(words.join(""));
    const combinedFcards = await tryOfficialDomains(combinedWord);
    results.push(...firstWordFcards, ...combinedFcards);
  }

  // Step 3: Fallback to category sources if nothing
  if (results.length === 0) {
    const categories = pickCategories(query);
    const sourceFcards = await crawlSources(query, categories);
    results.push(...sourceFcards);
  }

  // Step 4: Fallback empty
  if (results.length === 0) {
    results.push({
      title: "No Results",
      url: null,
      snippet: "No fcards could be generated for this query.",
      type: "fcards-empty"
    });
  }

  return results;
}

// --------------------
// Unified Entry Point
// --------------------
export async function handleNormalSearch(query) {
  return await generateFcards(query);
}
