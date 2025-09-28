// fcrawler2.js
import axios from "axios";
import * as cheerio from "cheerio";
import { TLDs } from "./tlds.js";         // 🔹 Import TLDs
import { sourceCategories } from "./sites.js";  // 🔹 Import sites

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

// 🔹 Test all TLDs simultaneously
async function tryOfficialDomains(query) {
  const domainQuery = normalizeForDomain(query);

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
        `Official website for ${query}`;
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

// 🔹 Unified search
export async function handleNormalSearch(query) {
  const categories = pickCategories(query);

  // Run TLD + Sources simultaneously
  const [officialCards, sourceCards] = await Promise.all([
    tryOfficialDomains(query),
    crawlSources(query, categories),
  ]);

  const cards = [...officialCards, ...sourceCards];

  return cards.length > 0
    ? cards
    : [{
        title: "No Results",
        url: null,
        snippet: "No fcards could be generated for this query.",
        type: "fcards-empty",
      }];
}
