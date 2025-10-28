// fcrawler2.js
import axios from "axios";
import * as cheerio from "cheerio";
import { TLDs } from "./tlds.js"; // full TLD list (100+)

// --------------------
// Helpers
// --------------------
function normalizeForDomain(query) {
  return query.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

// Fetch fcard info
async function fetchFcard(url, timeout = 7000) {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      timeout,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400, // Only real pages or redirects
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
        snippet: "Your query must contain letters or numbers.",
      },
    ];
  }

  // Use all TLDs from tlds.js
  const selectedTLDs = TLDs;

  // Generate URLs for all TLDs
  const urls = selectedTLDs.map((tld) => `https://${normalized}${tld}`);

  // Fetch all in parallel
  const resultsArr = await Promise.all(urls.map((url) => fetchFcard(url)));

  // Remove duplicates (by hostname + title)
  const seenDomains = new Set();
  const seenTitles = new Set();
  const uniqueResults = [];

  for (const result of resultsArr) {
    if (
      result &&
      !seenDomains.has(new URL(result.url).hostname) &&
      !seenTitles.has(result.title.toLowerCase())
    ) {
      seenDomains.add(new URL(result.url).hostname);
      seenTitles.add(result.title.toLowerCase());
      uniqueResults.push(result);
    }
  }

  // Handle no results
  if (uniqueResults.length === 0) {
    return [
      {
        title: "No Results",
        url: null,
        snippet: "No fcards could be generated for this query.",
      },
    ];
  }

  return uniqueResults;
}
