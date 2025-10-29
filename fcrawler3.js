import axios from "axios";
import * as cheerio from "cheerio";
import { TLDs } from "./tlds.js"; // full list of TLDs
import { stripDefWords } from "./definitionWords.js"; // helper we'll add below

// ------------------------------
// Helper: fetch a definition site page
// ------------------------------
async function fetchDefinition(url) {
  try {
    const res = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      },
      timeout: 8000,
      maxRedirects: 5,
    });

    const $ = cheerio.load(res.data);
    const title = $("title").text().trim().substring(0, 100) || url;
    const snippet =
      $("p").first().text().trim().substring(0, 300) ||
      "No definition snippet found";

    return { title, url, snippet, type: "definition" };
  } catch {
    return null;
  }
}

// ------------------------------
// Helper: fetch general site (for TLD test)
// ------------------------------
async function fetchSite(url) {
  try {
    const res = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      },
      timeout: 7000,
      maxRedirects: 5,
      validateStatus: s => s >= 200 && s < 400,
    });

    const finalUrl = res.request.res.responseUrl || url;
    const $ = cheerio.load(res.data);
    const title = $("title").first().text().trim() || new URL(finalUrl).hostname;
    const snippet =
      $("p").first().text().trim().substring(0, 300) || "No snippet available";

    return { title, url: finalUrl, snippet, type: "tld" };
  } catch {
    return null;
  }
}

// ------------------------------
// Definition sources
// ------------------------------
const definitionSites = [
  "https://en.wikipedia.org/wiki/",
  "https://www.merriam-webster.com/dictionary/",
  "https://dictionary.cambridge.org/dictionary/english/",
  "https://www.lexico.com/definition/",
  "https://www.britannica.com/topic/",
  "https://www.vocabulary.com/dictionary/",
  "https://www.collinsdictionary.com/dictionary/english/",
  "https://www.yourdictionary.com/",
  "https://www.thefreedictionary.com/",
  "https://dictionary.apa.org/",
];

// ------------------------------
// Main function
// ------------------------------
export async function handleDefinitionSearch(query) {
  console.log("📘 Running definition search for:", query);

  // Extract the core term (remove "define", "what is", etc.)
  const coreTerm = stripDefWords(query).trim().toLowerCase();

  // Construct URLs for definition sources
  const defUrls = definitionSites.map(base => base + encodeURIComponent(coreTerm));

  // Run all definition requests in parallel
  const defResults = await Promise.all(defUrls.map(fetchDefinition));
  const validDefResults = defResults.filter(r => r);

  // -------------------------
  // TLD testing (for core term)
  // -------------------------
  const selectedTLDs = TLDs.slice(0, 10);
  const tldUrls = selectedTLDs.map(tld => `https://${coreTerm}${tld}`);
  const tldResults = await Promise.all(tldUrls.map(fetchSite));
  const validTldResults = tldResults.filter(r => r);

  // Merge both sets
  const merged = [...validDefResults, ...validTldResults];

  // Handle duplicates
  const seen = new Set();
  const uniqueResults = merged.filter(r => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  // If nothing found
  if (uniqueResults.length === 0) {
    return [
      {
        title: "No Results",
        url: null,
        snippet: "No definition or TLD results found for this query.",
        type: "empty",
      },
    ];
  }

  return uniqueResults;
}
