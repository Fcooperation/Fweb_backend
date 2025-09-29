// fcrawler2.js
import axios from "axios";
import * as cheerio from "cheerio";
import { TLDs } from "./tlds.js";              // 🔹 Import TLDs
import { sourceCategories } from "./sites.js"; // 🔹 Import sites

// Pick categories
function pickCategories(query) {
  const q = query.toLowerCase();
  if (q.includes("software") || q.includes("programming")) return ["tech"];
  if (q.includes("health") || q.includes("science")) return ["science"];
  if (q.includes("school") || q.includes("education")) return ["education"];
  return ["general"];
}

// Normalize query for domain tests
function normalizeForDomain(query) {
  return query.replace(/[^a-zA-Z0-9]/g, "");
}

// Special trigger keywords for knowledge sources
const knowledgeTriggers = ["define", "what is", "how to"];
const knowledgeSources = ["https://en.wikipedia.org", "https://www.britannica.com"];

// 🔹 Generate fcards for knowledge triggers
function handleKnowledgeTriggers(query) {
  const lower = query.toLowerCase();
  if (knowledgeTriggers.some(trigger => lower.startsWith(trigger))) {
    return knowledgeSources.map(url => ({
      title: url,
      url,
      snippet: `Knowledge source for "${query}"`,
      favicon: `https://www.google.com/s2/favicons?sz=64&domain_url=${url}`,
      type: "fcards"
    }));
  }
  return [];
}

// 🔹 Test all TLDs for a given base query
async function tryOfficialDomains(baseQuery) {
  const domainQuery = normalizeForDomain(baseQuery);

  const promises = TLDs.map(async (tld) => {
    const url = `https://${domainQuery}${tld}`;
    try {
      const response = await axios.get(url, {
        headers: { "User-Agent": "FwebFcards/1.0 (+https://fweb.africa)" },
        timeout: 4000,
      });

      const $ = cheerio.load(response.data);
      const title = $("title").first().text().trim() || url;
      const snippet =
        $("p").first().text().trim().substring(0, 200) ||
        `Official website for ${baseQuery}`;
      const favicon = `https://www.google.com/s2/favicons?sz=64&domain_url=${url}`;

      return { title, url, favicon, snippet, type: "fcards" };
    } catch {
      return null;
    }
  });

  const results = await Promise.allSettled(promises);
  return results.filter(r => r.status === "fulfilled" && r.value).map(r => r.value);
}

// 🔹 Crawl hardcoded sources simultaneously
async function crawlSources(query, categories) {
  const selectedSources = categories.flatMap(cat => sourceCategories[cat] || []);

  const promises = selectedSources.map(async (buildUrl) => {
    const url = buildUrl(query);
    try {
      const response = await axios.get(url, {
        headers: { "User-Agent": "FwebFcards/1.0 (+https://fweb.africa)" },
        timeout: 6000,
      });

      const $ = cheerio.load(response.data);
      const title = $("title").first().text().trim() || url;
      const snippet = $("p").first().text().trim().substring(0, 200) || "No snippet available.";
      let favicon =
        $('link[rel="icon"]').attr("href") ||
        $('link[rel="shortcut icon"]').attr("href") ||
        "/favicon.ico";

      if (favicon && !favicon.startsWith("http")) {
        favicon = new URL(favicon, url).href;
      }

      return { title, url, favicon, snippet, type: "fcards" };
    } catch {
      return null;
    }
  });

  const results = await Promise.allSettled(promises);
  return results.filter(r => r.status === "fulfilled" && r.value).map(r => r.value);
}

// 🔹 Generate fcards based on query rules
async function generateFcards(query) {
  // Handle special knowledge triggers first
  const knowledgeFcards = handleKnowledgeTriggers(query);
  if (knowledgeFcards.length > 0) return knowledgeFcards;

  const words = query.trim().split(/\s+/);
  let results = [];

  if (words.length === 1) {
    // Single word → test all TLDs
    results = await tryOfficialDomains(words[0]);
  } else {
    // Multi-word → first word TLDs first
    const firstWordFcards = await tryOfficialDomains(words[0]);
    const combinedWord = normalizeForDomain(words.join(""));
    const combinedFcards = await tryOfficialDomains(combinedWord);
    results = [...firstWordFcards, ...combinedFcards];
  }

  // If no TLD results, try sources
  if (results.length === 0) {
    const categories = pickCategories(query);
    const sourceFcards = await crawlSources(query, categories);
    results = sourceFcards;
  }

  // Fallback if nothing found
  if (results.length === 0) {
    results = [{
      title: "No Results",
      url: null,
      snippet: "No fcards could be generated for this query.",
      type: "fcards-empty",
    }];
  }

  return results;
}

// 🔹 Unified search entry point
export async function handleNormalSearch(query) {
  return await generateFcards(query);
}
