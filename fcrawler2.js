import axios from "axios";
import * as cheerio from "cheerio";

// 🔹 Trusted sources grouped by category
const sourceCategories = {
  general: [/* … */],
  tech: [/* … */],
  science: [/* … */],
  education: [/* … */],
};

// 🔹 Pick categories dynamically
function pickCategories(query) {
  const q = query.toLowerCase();
  if (q.includes("how to") || q.includes("software") || q.includes("programming")) return ["tech"];
  if (q.includes("health") || q.includes("biology") || q.includes("science")) return ["science"];
  if (q.includes("study") || q.includes("definition") || q.includes("school")) return ["education"];
  return ["general"];
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

      const html = response.data;
      const $ = cheerio.load(html);

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
