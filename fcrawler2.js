// fcrawler2.js
import axios from "axios";
import * as cheerio from "cheerio";
import { TLDs } from "./tlds.js";              // 🔹 Import TLDs
import { sourceCategories } from "./sites.js"; // 🔹 Import category sources

// --------------------
// 1. Query Categories
// --------------------
function pickCategories(query) {
  const q = query.toLowerCase();
  if (q.includes("software") || q.includes("programming")) return ["tech"];
  if (q.includes("health") || q.includes("science")) return ["science"];
  if (q.includes("school") || q.includes("education")) return ["education"];
  return ["general"];
}

// --------------------
// 2. Normalize Query
// --------------------
function normalizeForDomain(query) {
  return query.replace(/[^a-zA-Z0-9]/g, "");
}

// --------------------
// 3. Definition Triggers & Knowledge Sites
// --------------------
const definitionTriggers = [
  "define",
  "definition of",
  "what is",
  "what's",
  "how to",
  "explain",
  "meaning of",
  "describe",
  "tell me about",
  "give me info on",
  "information about",
  "what are",
  "who is"
];

// 20 knowledge/reference sites
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
// 4. Helper: Check if query is definition-style
// --------------------
function isDefinitionQuery(query) {
  const lower = query.toLowerCase();
  return definitionTriggers.some(trigger => lower.startsWith(trigger));
}

// --------------------
// 5. Knowledge Fcards
// --------------------
async function handleKnowledgeSources(query) {
  const promises = knowledgeSites.map(async (site) => {
    try {
      const url = `${site}/wiki/${encodeURIComponent(query)}`; // Basic assumption: query appended to wiki-like structure
      const response = await axios.get(url, {
        headers: { "User-Agent": "FwebFcards/1.0 (+https://fweb.africa)" },
        timeout: 4000
      });
      const $ = cheerio.load(response.data);
      const snippet = $("p").first().text().trim().substring(0, 200);
      if (!snippet) return null; // Only show if content exists
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
// 6. TLD Fcards
// --------------------
async function tryOfficialDomains(baseQuery) {
  const domainQuery = normalizeForDomain(baseQuery);

  const promises = TLDs.map(async (tld) => {
    const url = `https://${domainQuery}${tld}`;
    try {
      const response = await axios.get(url, {
        headers: { "User-Agent": "FwebFcards/1.0 (+https://fweb.africa)" },
        timeout: 4000
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

// --------------------
// 7. Category Sources Fcards
// --------------------
async function crawlSources(query, categories) {
  const selectedSources = categories.flatMap(cat => sourceCategories[cat] || []);

  const promises = selectedSources.map(async (buildUrl) => {
    const url = buildUrl(query);
    try {
      const response = await axios.get(url, {
        headers: { "User-Agent": "FwebFcards/1.0 (+https://fweb.africa)" },
        timeout: 6000
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

// --------------------
// 8. Main Fcard Generation
// --------------------
async function generateFcards(query) {
  let results = [];

  // Step 1: Knowledge sources (definition triggers)
  if (isDefinitionQuery(query)) {
    const knowledgeFcards = await handleKnowledgeSources(query);
    results.push(...knowledgeFcards);
  }

  const words = query.trim().split(/\s+/);

  // Step 2: Single-word TLDs
  if (words.length === 1) {
    const tldFcards = await tryOfficialDomains(words[0]);
    results.push(...tldFcards);
  } else {
    // Step 3: Multi-word query → first word, then combined
    const firstWordFcards = await tryOfficialDomains(words[0]);
    const combinedWord = normalizeForDomain(words.join(""));
    const combinedFcards = await tryOfficialDomains(combinedWord);
    results.push(...firstWordFcards, ...combinedFcards);
  }

  // Step 4: If nothing found, fallback to category sources
  if (results.length === 0) {
    const categories = pickCategories(query);
    const sourceFcards = await crawlSources(query, categories);
    results.push(...sourceFcards);
  }

  // Step 5: Fallback empty
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
// 9. Unified Entry Point
// --------------------
export async function handleNormalSearch(query) {
  return await generateFcards(query);
}
