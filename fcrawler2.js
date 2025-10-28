// fcrawler2.js
import axios from "axios";
import * as cheerio from "cheerio";
import { TLDs } from "./tlds.js"; // full list (100+)

// --------------------
// 10 Most Common TLDs
// --------------------
const COMMON_TLDS = [
  ".com",
  ".net",
  ".org",
  ".io",
  ".co",
  ".us",
  ".info",
  ".biz",
  ".online",
  ".tech"
];

// --------------------
// Helpers
// --------------------
function normalizeForDomain(query) {
  return query.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

async function fetchFcard(url, timeout = 7000) {
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

    const finalUrl = response.request.res.responseUrl || url;
    const $ = cheerio.load(response.data);
    const snippet =
      $("p").first().text().trim().substring(0, 300) ||
      "No snippet available";
    const title = $("title").first().text().trim() || new URL(finalUrl).hostname;

    return { title, url: finalUrl, snippet };
  } catch {
    return null;
  }
}

// --------------------
// Core Search Function
// --------------------
async function testDomains(query, tldList) {
  const normalized = normalizeForDomain(query);
  const urls = tldList.map(tld => `https://${normalized}${tld}`);

  // Run all TLDs in parallel
  const resultsArr = await Promise.all(urls.map(url => fetchFcard(url)));

  // Filter valid + unique results
  const seen = new Set();
  const uniqueResults = [];
  for (const result of resultsArr) {
    if (result && !seen.has(new URL(result.url).hostname)) {
      seen.add(new URL(result.url).hostname);
      uniqueResults.push(result);
    }
  }

  return uniqueResults;
}

// --------------------
// Main function export
// --------------------
export async function handleNormalSearch(query) {
  const normalized = normalizeForDomain(query);
  if (!normalized) {
    return [
      {
        title: "Invalid Query",
        url: null,
        snippet: "Your query must contain letters or numbers."
      }
    ];
  }

  // 1️⃣ Try 10 common TLDs first
  let results = await testDomains(query, COMMON_TLDS);

  // 2️⃣ If no results found, test full TLD list from tlds.js
  if (results.length === 0) {
    results = await testDomains(query, TLDs);
  }

  // 3️⃣ Handle no matches
  if (results.length === 0) {
    return [
      {
        title: "No Results",
        url: null,
        snippet: `No fcards found for "${query}" on any TLD.`
      }
    ];
  }

  return results;
}
