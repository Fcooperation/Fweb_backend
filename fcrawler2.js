import axios from "axios";
import * as cheerio from "cheerio";

// 🔹 Trusted sources grouped by category
const sourceCategories = {
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
    (q) => `https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(q)}`
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
    (q) => `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(q)}`
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
    (q) => `https://www.nationalgeographic.com/science/search?q=${encodeURIComponent(q)}`
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
    (q) => `https://www.edx.org/search?q=${encodeURIComponent(q)}`
  ]
};

// 🔹 Common top-level domains
const TLDs = [".com", ".org", ".net", ".io", ".co", ".ai", ".dev", ".app", ".info", ".edu"];

// 🔹 Pick categories dynamically
function pickCategories(query) {
  const q = query.toLowerCase();
  if (q.includes("how to") || q.includes("software") || q.includes("programming")) return ["tech"];
  if (q.includes("health") || q.includes("biology") || q.includes("science")) return ["science"];
  if (q.includes("study") || q.includes("definition") || q.includes("school") || q.includes("education")) return ["education"];
  return ["general"];
}

// 🔹 Try official site by appending TLDs
async function tryOfficialDomains(query) {
  if (query.includes(" ")) return null; // only one-word searches

  for (const tld of TLDs) {
    const url = `https://${query}${tld}`;
    try {
      const response = await axios.get(url, {
        headers: { "User-Agent": "FwebFcards/1.0 (+https://fweb.africa)" },
        timeout: 5000,
      });

      const $ = cheerio.load(response.data);
      const title = $("title").first().text().trim() || url;
      const snippet = $("p").first().text().trim().substring(0, 200) || `Official website for ${query}`;
      const favicon = `https://www.google.com/s2/favicons?sz=64&domain_url=${url}`;

      return {
        title,
        url,
        favicon,
        snippet,
        type: "fcards",
      };
    } catch (err) {
      // Try next TLD silently
    }
  }

  return null;
}

// 🔹 Image search (basic scrape from DuckDuckGo)
async function fetchImages(query) {
  try {
    const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`;
    const res = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 8000,
    });

    const $ = cheerio.load(res.data);
    const images = [];

    $("img").each((i, el) => {
      const src = $(el).attr("src");
      if (src && src.startsWith("http")) {
        images.push({
          url: src,
          alt: $(el).attr("alt") || query,
          type: "image",
        });
      }
    });

    return images.slice(0, 10);
  } catch (err) {
    console.error("❌ Image fetch failed:", err.message);
    return [];
  }
}

// 🔹 Normal search handler (now returns fcards + images)
export async function handleNormalSearch(query) {
  const categories = pickCategories(query);
  const selectedSources = categories.flatMap((cat) => sourceCategories[cat]);

  // 🔹 Fcards fetch
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
  if (officialCard) {
    cards.unshift(officialCard);
  }

  // 🔹 Fetch images
  const images = await fetchImages(query);

  // 🔹 Return both fcards + images
  return {
    fcards: cards.length > 0 ? cards : [
      {
        title: "No Results",
        url: null,
        snippet: "No fcards could be generated for this query.",
        html: null,
        type: "fcards-empty",
      },
    ],
    images: images.length > 0 ? images : [
      {
        url: null,
        alt: "No images found",
        type: "image-empty",
      },
    ],
  };
}
