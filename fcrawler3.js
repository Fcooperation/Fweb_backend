import axios from "axios";
import * as cheerio from "cheerio";
import { TLDs } from "./tlds.js";
import { definitionWords, getDefinitionRoot } from "./definitionWords.js";

// ------------------------------
// Fetch from definition site
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
// Fetch normal site (for TLD test)
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
// Definition sites
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
// Core handler
// ------------------------------
export async function handleDefinitionSearch(query) {
  console.log("📘 Running definition search for:", query);

  // Full phrase for def sites
  const fullPhrase = query.trim();

  // Extract core term for TLDs (remove def phrase)
  const coreTerm = getDefinitionRoot(fullPhrase).trim().toLowerCase();

  // 1️⃣ Definition sites
  const defUrls = definitionSites.map(
    base => base + encodeURIComponent(fullPhrase)
  );

  const defResults = await Promise.all(defUrls.map(fetchDefinition));
  const validDefResults = defResults.filter(r => r);

  // 2️⃣ TLD tests (for only the core word)
  const selectedTLDs = TLDs.slice(0, 10);
  const tldUrls = selectedTLDs.map(tld => `https://${coreTerm}${tld}`);
  const tldResults = await Promise.all(tldUrls.map(fetchSite));
  const validTldResults = tldResults.filter(r => r);

  // Merge and deduplicate
  const seen = new Set();
  const merged = [...validDefResults, ...validTldResults].filter(r => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  if (merged.length === 0) {
    return [
      {
        title: "No Results",
        url: null,
        snippet: "No definition or TLD results found for this query.",
        type: "empty",
      },
    ];
  }

  return merged;
}
