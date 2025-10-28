// fcrawler2.js
import axios from "axios";
import * as cheerio from "cheerio";

// --------------------
// 10 Most Common TLDs
// --------------------
const COMMON_TLDS = [".com", ".net", ".org", ".io", ".co", ".us", ".info", ".biz", ".online", ".tech"];

// --------------------
// Helpers
// --------------------
function normalizeForDomain(query) {
  return query.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

// Fetch full fcard info
async function fetchFcard(url, timeout = 7000) {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      timeout,
      maxRedirects: 5
    });

    const finalUrl = response.request.res.responseUrl || url;
    const $ = cheerio.load(response.data);
    const snippet =
      $("p").first().text().trim().substring(0, 300) || "No snippet available";
    const title = $("title").first().text().trim() || new URL(finalUrl).hostname;

    return { title, url: finalUrl, snippet };
  } catch {
    return null;
  }
}

// --------------------
// Main function
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

  // Generate URLs for all 10 TLDs
  const urls = COMMON_TLDS.map(tld => `https://${normalized}${tld}`);

  // Fetch all in parallel
  const resultsArr = await Promise.all(urls.map(url => fetchFcard(url)));

  // Filter valid and unique results
  const seen = new Set();
  const results = resultsArr
    .filter(r => r && !seen.has(new URL(r.url).hostname))
    .map(r => {
      seen.add(new URL(r.url).hostname);
      return r;
    });

  // Handle no results
  if (results.length === 0) {
    return [
      {
        title: "No Results",
        url: null,
        snippet: "No fcards could be generated for this query."
      }
    ];
  }

  return results;
}
