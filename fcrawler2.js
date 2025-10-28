// fcrawler2.js
import axios from "axios";
import * as cheerio from "cheerio";

// --------------------
// Config
// --------------------
const TOP_TLDS = [
  ".com", ".net", ".org", ".co", ".io", ".ai", ".info", ".biz", ".us", ".uk",
  ".ca", ".de", ".fr", ".in", ".co.uk", ".co.in", ".xyz", ".site", ".online", ".me",
  ".tv", ".store", ".app", ".tech", ".live", ".space", ".pro", ".academy", ".shop", ".world"
];

const DEF_SITES = [
  "https://en.wikipedia.org/wiki/",
  "https://www.britannica.com/search?query=",
  "https://dictionary.cambridge.org/dictionary/english/",
  "https://www.merriam-webster.com/dictionary/",
  "https://www.vocabulary.com/dictionary/",
  "https://www.lexico.com/definition/",
  "https://www.collinsdictionary.com/dictionary/english/",
  "https://www.urbandictionary.com/define.php?term=",
  "https://simple.wikipedia.org/wiki/",
  "https://kids.britannica.com/students/search/dictionary?query="
];

const REQUEST_TIMEOUT = 7000;

// --------------------
// Helpers
// --------------------
function normalizeForDomain(query) {
  return query.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

async function fetchFcard(url, timeout = REQUEST_TIMEOUT) {
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

    const finalUrl =
      response.request?.res?.responseUrl ||
      response.config?.url ||
      url;

    const $ = cheerio.load(response.data);
    const snippet = $("p").first().text().trim().substring(0, 300) || "No snippet available";
    const title = $("title").first().text().trim() || new URL(finalUrl).hostname;

    return { title, url: finalUrl, snippet };
  } catch {
    return null;
  }
}

function makeUrl(domain, tld) {
  return `https://${domain}${tld}`;
}

async function fetchUrlsInParallel(urls) {
  const promises = urls.map(u => fetchFcard(u));
  const resultsArr = await Promise.all(promises);
  return resultsArr.filter(r => r);
}

// --------------------
// Core Search Logic
// --------------------
export async function handleNormalSearch(query) {
  if (!query || !query.trim()) {
    return [
      { title: "Invalid Query", url: null, snippet: "Your query must contain text." }
    ];
  }

  const normalized = normalizeForDomain(query);
  const tldUrls = TOP_TLDS.map(tld => makeUrl(normalized, tld));

  // Definition/info site URLs
  const defUrls = DEF_SITES.map(site => site + encodeURIComponent(query.trim()));

  // Run both parallel
  const [tldResults, defResults] = await Promise.all([
    fetchUrlsInParallel(tldUrls),
    fetchUrlsInParallel(defUrls)
  ]);

  const finalResults = [];

  // Add TLD fcards first
  for (const r of tldResults) finalResults.push(r);
  // Then add definition/info site fcards
  for (const r of defResults) finalResults.push(r);

  if (finalResults.length === 0) {
    return [
      { title: "No Results", url: null, snippet: `No fcards found for "${query}".` }
    ];
  }

  return finalResults;
}
