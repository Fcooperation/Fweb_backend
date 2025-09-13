import axios from "axios";
import * as cheerio from "cheerio";

// 🔹 Trusted sources grouped by category
// 🔹 Trusted sources grouped by category
export const sourceCategories = {
  general: [
    (q) => `https://en.wikipedia.org/wiki/${encodeURIComponent(q)}`,
    (q) => `https://www.britannica.com/search?query=${encodeURIComponent(q)}`,
    (q) => `https://www.quora.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.infoplease.com/search/${encodeURIComponent(q)}`,
    (q) => `https://www.bbc.co.uk/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.theguardian.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.nationalgeographic.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.npr.org/search?query=${encodeURIComponent(q)}`,
    (q) => `https://www.history.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(q)}`,
    
    // 🔹 African general sources
    (q) => `https://www.sabcnews.com/sabcsearch/?q=${encodeURIComponent(q)}`,
    (q) => `https://www.timeslive.co.za/search/?q=${encodeURIComponent(q)}`,
    (q) => `https://www.news24.com/search?query=${encodeURIComponent(q)}`,
    (q) => `https://www.ghanaweb.com/Search/?q=${encodeURIComponent(q)}`,
    (q) => `https://www.vanguardngr.com/?s=${encodeURIComponent(q)}`,
    (q) => `https://www.dailytrust.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.thisdaylive.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.premiumtimesng.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.thecitizen.co.tz/search/?q=${encodeURIComponent(q)}`,
    (q) => `https://www.nation.africa/search?search=${encodeURIComponent(q)}`
  ],

  tech: [
    (q) => `https://techcrunch.com/search/${encodeURIComponent(q)}`,
    (q) => `https://www.theverge.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.howtogeek.com/search/${encodeURIComponent(q)}`,
    (q) => `https://www.makeuseof.com/?s=${encodeURIComponent(q)}`,
    (q) => `https://www.zdnet.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.wired.com/search/?q=${encodeURIComponent(q)}`,
    (q) => `https://www.digitaltrends.com/?s=${encodeURIComponent(q)}`,
    (q) => `https://www.tomshardware.com/search?searchTerm=${encodeURIComponent(q)}`,
    (q) => `https://arstechnica.com/search/?query=${encodeURIComponent(q)}`,
    (q) => `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(q)}`,

    // 🔹 African tech sources (static / minimal JS)
    (q) => `https://techpoint.africa/search/?q=${encodeURIComponent(q)}`,
    (q) => `https://www.techzim.co.zw/?s=${encodeURIComponent(q)}`,
    (q) => `https://www.itweb.co.za/search-results/?q=${encodeURIComponent(q)}`,
    (q) => `https://www.businessdailyafrica.com/search/?q=${encodeURIComponent(q)}`,
    (q) => `https://www.techweez.com/?s=${encodeURIComponent(q)}`
  ],

  science: [
    (q) => `https://www.nature.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.scientificamerican.com/search/?q=${encodeURIComponent(q)}`,
    (q) => `https://www.space.com/search?searchTerm=${encodeURIComponent(q)}`,
    (q) => `https://www.sciencenews.org/?s=${encodeURIComponent(q)}`,
    (q) => `https://www.livescience.com/search?searchTerm=${encodeURIComponent(q)}`,
    (q) => `https://www.nih.gov/search?query=${encodeURIComponent(q)}`,
    (q) => `https://www.mayoclinic.org/search/search-results?q=${encodeURIComponent(q)}`,
    (q) => `https://www.healthline.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.webmd.com/search/search_results/default.aspx?query=${encodeURIComponent(q)}`,
    (q) => `https://www.nationalgeographic.com/science/search?q=${encodeURIComponent(q)}`,

    // 🔹 African science / health
    (q) => `https://www.ajol.info/index.php/ajol/search/search?query=${encodeURIComponent(q)}`,
    (q) => `https://www.health24.com/Search?query=${encodeURIComponent(q)}`,
    (q) => `https://www.medicalbrief.co.za/?s=${encodeURIComponent(q)}`,
    (q) => `https://www.ghanahealthservice.org/search.php?q=${encodeURIComponent(q)}`
  ],

  education: [
    (q) => `https://plato.stanford.edu/search/searcher.py?query=${encodeURIComponent(q)}`,
    (q) => `https://www.jstor.org/action/doBasicSearch?Query=${encodeURIComponent(q)}`,
    (q) => `https://scholar.google.com/scholar?q=${encodeURIComponent(q)}`,
    (q) => `https://www.coursehero.com/search/?q=${encodeURIComponent(q)}`,
    (q) => `https://quizlet.com/subject/${encodeURIComponent(q)}`,
    (q) => `https://www.sparknotes.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.ck12.org/search/?q=${encodeURIComponent(q)}`,
    (q) => `https://eric.ed.gov/?q=${encodeURIComponent(q)}`,
    (q) => `https://ocw.mit.edu/search/?q=${encodeURIComponent(q)}`,
    (q) => `https://www.edx.org/search?q=${encodeURIComponent(q)}`,

    // 🔹 African education sources
    (q) => `https://www.nou.edu.ng/search/node/${encodeURIComponent(q)}`,
    (q) => `https://www.unisa.ac.za/sites/corporate/default/Search-Results?query=${encodeURIComponent(q)}`,
    (q) => `https://www.uct.ac.za/search?search_api_fulltext=${encodeURIComponent(q)}`,
    (q) => `https://www.ug.edu.gh/search/node/${encodeURIComponent(q)}`,
    (q) => `https://www.ku.ac.ke/search?search_api_fulltext=${encodeURIComponent(q)}`
  ]
};
// 🔹 Top-level domains for official domain testing
export const TLDs = [
  // 🔹 Generic / global
  ".com", ".org", ".net", ".io", ".co", ".ai", ".dev", ".app", ".info", ".edu",
  ".biz", ".tech", ".online", ".site", ".store", ".web", ".me", ".cloud", ".xyz", ".pro",
  ".global", ".today", ".news", ".media", ".agency", ".solutions", ".systems", ".services",
  ".group", ".network", ".digital", ".world", ".center", ".space", ".company", ".studio", ".website",

  // 🔹 African country TLDs
  ".ng", ".za", ".ke", ".gh", ".tz", ".ug", ".eg", ".dz", ".ma", ".sn",
  ".ci", ".ml", ".cm", ".et", ".mu", ".bw", ".na", ".rw", ".zw", ".zm",
  ".ls", ".mg", ".gh", ".sd", ".tn", ".ly", ".gn", ".bf", ".cg", ".gq",
  ".er", ".dj", ".sc", ".km", ".so", ".st", ".cv", ".mw", ".ao", ".ml",
  ".ne", ".td", ".mr", ".ss", ".ga", ".bi", ".bj", ".cg", ".km", ".ls",
  ".sz", ".tg", ".gm", ".lr", ".sl", ".dj", ".re", ".yt", ".mu", ".ma",

  // 🔹 More generic for completeness
  ".tech", ".info", ".online", ".site", ".app", ".store", ".dev", ".cloud", ".network", ".digital",
  ".solutions", ".services", ".group", ".world", ".center", ".space", ".company", ".studio", ".website", ".news"
];
// 🔹 Pick categories dynamically
function pickCategories(query) {
  const q = query.toLowerCase();
  if (q.includes("how to") || q.includes("software") || q.includes("programming")) return ["tech"];
  if (q.includes("health") || q.includes("biology") || q.includes("science")) return ["science"];
  if (q.includes("study") || q.includes("definition") || q.includes("school") || q.includes("education")) return ["education"];
  return ["general"];
}

// 🔹 Helper: normalize any multi-word query for domains
function normalizeForDomain(query) {
  // Remove all non-alphanumeric characters and join words
  return query.replace(/[^a-zA-Z0-9]/g, '');
}

// 🔹 Try official site by appending TLDs
async function tryOfficialDomains(query) {
  const domainQuery = normalizeForDomain(query);

  for (const tld of TLDs) {
    const url = `https://${domainQuery}${tld}`;
    try {
      const response = await axios.get(url, {
        headers: { "User-Agent": "FwebFcards/1.0 (+https://fweb.africa)" },
        timeout: 5000,
      });

      const $ = cheerio.load(response.data);
      const title = $("title").first().text().trim() || url;
      const snippet = $("p").first().text().trim().substring(0, 200) || `Official website for ${query}`;
      const favicon = `https://www.google.com/s2/favicons?sz=64&domain_url=${url}`;

      return { title, url, favicon, snippet, type: "fcards" };
    } catch (err) {
      // silently try next TLD
    }
  }

  return null;
}

// 🔹 Normal search handler
export async function handleNormalSearch(query) {
  const categories = pickCategories(query);
  const selectedSources = categories.flatMap((cat) => sourceCategories[cat]);

  const requests = selectedSources.map(async (buildUrl) => {
    const url = buildUrl(query);
    try {
      const response = await axios.get(url, {
        headers: { "User-Agent": "FwebFcards/1.0 (+https://fweb.africa)" },
        timeout: 8000,
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
    } catch (err) {
      console.error("❌ Fcards fetch failed for", url, err.message);
      return null;
    }
  });

  const results = await Promise.allSettled(requests);
  let cards = results
    .filter((r) => r.status === "fulfilled" && r.value)
    .map((r) => r.value);

  // 🔹 Prepend official site if found
  const officialCard = await tryOfficialDomains(query);
  if (officialCard) cards.unshift(officialCard);

  return cards.length > 0
    ? cards
    : [
        {
          title: "No Results",
          url: null,
          snippet: "No fcards could be generated for this query.",
          html: null,
          type: "fcards-empty",
        },
      ];
}
