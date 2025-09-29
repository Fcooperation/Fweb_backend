import axios from "axios";
import * as cheerio from "cheerio";
import { TLDs } from "./tlds.js";                 // lowercase filename
import { sourceCategories } from "./sites.js";
import { definitionWords } from "./definitionWords.js";

// --------------------
// Helpers
// --------------------
function normalizeForDomain(query) {
  return query.replace(/[^a-zA-Z0-9]/g, "");
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
// Knowledge/definition fcards via sites.js
// --------------------
async function handleKnowledgeSources(query) {
  const term = stripDefinitionWords(query);

  // Use all categories for knowledge searches
  const allSources = Object.values(sourceCategories).flat();
  
  const promises = allSources.map(async buildUrl => {
    const url = buildUrl(term);
    try {
      const response = await axios.get(url, {
        headers: { "User-Agent": "FwebFcards/1.0 (+https://fweb.africa)" },
        timeout: 4000
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
// Fallback category sources fcards
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
// Generate Fcards
// --------------------
async function generateFcards(query) {
  let results = [];

  if (isDefinitionQuery(query)) {
    // --------------------
    // Definition queries → ONLY knowledge sources from sites.js
    // --------------------
    results = await handleKnowledgeSources(query);
  } else {
    // --------------------
    // Normal queries → TLDs + multi-word + fallback sources
    // --------------------
    const cleanedQuery = stripDefinitionWords(query);
    const words = cleanedQuery.trim().split(/\s+/);

    if (words.length === 1) {
      const tldFcards = await tryOfficialDomains(words[0]);
      results.push(...tldFcards);
    } else {
      const firstWordFcards = await tryOfficialDomains(words[0]);
      const combinedWord = normalizeForDomain(words.join(""));
      const combinedFcards = await tryOfficialDomains(combinedWord);
      results.push(...firstWordFcards, ...combinedFcards);
    }

    // Fallback category sources
    if (results.length === 0) {
      const categories = pickCategories(query);
      const sourceFcards = await crawlSources(query, categories);
      results.push(...sourceFcards);
    }
  }

  // --------------------
  // Fallback empty
  // --------------------
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

// --------------------
// Category picker
// --------------------
function pickCategories(query) {
  const q = query.toLowerCase();
  if (q.includes("software") || q.includes("programming")) return ["tech"];
  if (q.includes("health") || q.includes("science")) return ["science"];
  if (q.includes("school") || q.includes("education")) return ["education"];
  return ["general"];
}
