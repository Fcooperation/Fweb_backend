// fcrawler2.js
import axios from "axios";
import * as cheerio from "cheerio";

// Top 10 common TLDs
const COMMON_TLDS = [".com", ".net", ".org", ".io", ".co", ".us", ".info", ".biz", ".online", ".tech"];

// --------------------
// Helpers
// --------------------
function normalizeForDomain(domain) {
  return domain.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

// Fetch fcard for a URL
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

    const finalUrl = response.request.res.responseUrl;
    const $ = cheerio.load(response.data);
    const snippet = $("p").first().text().trim().substring(0, 300) || "No snippet available";
    const title = $("title").first().text().trim() || new URL(finalUrl).hostname;

    return { title, url: finalUrl, snippet };
  } catch {
    return null; // skip dead or blocked sites
  }
}

// Generate URLs for Google + common TLDs
function generateGoogleUrls() {
  const google = normalizeForDomain("Google");
  return COMMON_TLDS.map(tld => `https://${google}${tld}`);
}

// --------------------
// Main function
// --------------------
export async function handleNormalSearch(query) {
  // For now we ignore query and always test Google TLDs
  const urls = generateGoogleUrls();

  // Launch all requests simultaneously
  const resultsArr = await Promise.all(urls.map(url => fetchFcard(url)));

  // Only keep successful fcards
  const results = resultsArr.filter(r => r);

  if (results.length === 0) {
    return [{ title: "No Results", url: null, snippet: "No fcards could be generated." }];
  }

  return results;
}
