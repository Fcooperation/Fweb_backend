// fcrawler.js
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
    (q) => `https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(q)}`,
  ],
  tech: [
    (q) => `https://www.techcrunch.com/search/${encodeURIComponent(q)}`,
    (q) => `https://www.theverge.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.howtogeek.com/search/${encodeURIComponent(q)}`,
    (q) => `https://www.makeuseof.com/?s=${encodeURIComponent(q)}`,
    (q) => `https://www.zdnet.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.wired.com/search/?q=${encodeURIComponent(q)}`,
    (q) => `https://www.digitaltrends.com/?s=${encodeURIComponent(q)}`,
    (q) => `https://www.tomshardware.com/search?searchTerm=${encodeURIComponent(q)}`,
    (q) => `https://arstechnica.com/search/?query=${encodeURIComponent(q)}`,
    (q) => `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(q)}`,
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
  ],
};

// 🔹 Pick categories dynamically based on keywords
function pickCategories(query) {
  const q = query.toLowerCase();

  if (q.includes("how to") || q.includes("software") || q.includes("technology") || q.includes("programming")) {
    return ["tech"];
  }
  if (q.includes("health") || q.includes("disease") || q.includes("biology") || q.includes("science")) {
    return ["science"];
  }
  if (q.includes("study") || q.includes("definition") || q.includes("philosophy") || q.includes("school")) {
    return ["education"];
  }

  // Default fallback → general
  return ["general"];
}

// 🔹 Main handler
export async function handleSearch(query) {
  const isLink = /^https?:\/\/|^[\w-]+\.[a-z]{2,}/i.test(query);

  if (!isLink) {
    const categories = pickCategories(query);
    const selectedSources = categories.flatMap((cat) => sourceCategories[cat]);

    // Fetch all sites in parallel
    const requests = selectedSources.map(async (buildUrl) => {
      const url = buildUrl(query);
      try {
        const response = await axios.get(url, {
          headers: { "User-Agent": "FwebFcards/1.0 (+https://fweb.africa)" },
          timeout: 8000,
        });

        const html = response.data;
        const $ = cheerio.load(html);

        const title = $("title").first().text().trim() || url;
        const snippet =
          $("p").first().text().trim().substring(0, 200) ||
          "No snippet available.";
        let favicon =
          $('link[rel="icon"]').attr("href") ||
          $('link[rel="shortcut icon"]').attr("href") ||
          "/favicon.ico";

        if (favicon && !favicon.startsWith("http")) {
          favicon = new URL(favicon, url).href;
        }

        return {
          title,
          url,
          favicon,
          snippet,
          type: "fcards",
        };
      } catch (err) {
        console.error("❌ Fcards fetch failed for", url, err.message);
        return null;
      }
    });

    const results = await Promise.allSettled(requests);
    const cards = results
      .filter((r) => r.status === "fulfilled" && r.value)
      .map((r) => r.value);

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

  // 🔹 Link search
  const url = query.startsWith("http") ? query : "https://" + query;
  return [
    {
      title: "Link Search",
      url,
      snippet: "This search is a URL and is sent directly back to the frontend.",
      html: null,
      type: "link",
    },
  ];
}
