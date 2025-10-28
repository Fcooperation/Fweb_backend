// fcrawler2.js
import axios from "axios";
import * as cheerio from "cheerio";
import { TLDs } from "./tlds.js";

// --------------------
// Helpers
// --------------------
function normalizeForDomain(query) {
  return query.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

// Fetch fcard for a URL, following redirects
async function fetchFcard(url, timeout = 7000) {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      timeout,
      maxRedirects: 5
    });

    const $ = cheerio.load(response.data);
    const snippet = $("p").first().text().trim().substring(0, 300) || "No snippet available";
    const title = $("title").first().text().trim() || new URL(response.request.res.responseUrl).hostname;

    let favicon =
      $('link[rel="icon"]').attr("href") ||
      $('link[rel="shortcut icon"]').attr("href") ||
      $('link[rel="apple-touch-icon"]').attr("href") ||
      "/favicon.ico";

    if (favicon && !favicon.startsWith("http")) {
      try {
        favicon = new URL(favicon, response.request.res.responseUrl).href;
      } catch {
        favicon = null;
      }
    }

    return { title, url: response.request.res.responseUrl, favicon, snippet };
  } catch (err) {
    return null; // skip non-existent or blocked sites
  }
}

// Generate all URLs for a word or combined query
function generateUrlsForWord(word) {
  const normalized = normalizeForDomain(word);
  return TLDs.map(tld => `https://${normalized}${tld}`);
}

// --------------------
// Main function
// --------------------
export async function handleNormalSearch(query) {
  const words = query.trim().split(/\s+/);
  const combined = words.join("");

  // Combined + single words
  const allWords = [combined, ...words];

  // Generate all URLs
  const allUrls = allWords.flatMap(word => generateUrlsForWord(word));

  // Remove duplicates
  const uniqueUrls = [...new Set(allUrls)];

  // Fetch all URLs simultaneously
  const fetchPromises = uniqueUrls.map(url => fetchFcard(url));
  const resultsArr = await Promise.all(fetchPromises);

  // Only keep successful fcards
  const results = resultsArr.filter(r => r);

  if (results.length === 0) {
    return [{ title: "No Results", url: null, favicon: null, snippet: "No fcards could be generated." }];
  }

  return results;
}
