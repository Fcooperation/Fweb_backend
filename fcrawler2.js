// fcrawler2.js
import axios from "axios";
import * as cheerio from "cheerio";

// 🔹 Trusted sources for text
const sourceCategories = {
  general: [
    (q) => `https://en.wikipedia.org/wiki/${encodeURIComponent(q)}`,
    (q) => `https://www.britannica.com/search?query=${encodeURIComponent(q)}`,
    (q) => `https://www.npr.org/search?query=${encodeURIComponent(q)}`,
    (q) => `https://www.theguardian.com/search?q=${encodeURIComponent(q)}`
  ],
  tech: [
    (q) => `https://www.techradar.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.theverge.com/search?q=${encodeURIComponent(q)}`
  ],
  science: [
    (q) => `https://www.nature.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.scientificamerican.com/search/?q=${encodeURIComponent(q)}`
  ],
  education: [
    (q) => `https://scholar.google.com/scholar?q=${encodeURIComponent(q)}`
  ]
};

// 🔹 Hardcoded image & video sites
const imageSites = [
  (q) => `https://unsplash.com/s/photos/${encodeURIComponent(q)}`,
  (q) => `https://www.pexels.com/search/${encodeURIComponent(q)}/`,
  (q) => `https://pixabay.com/images/search/${encodeURIComponent(q)}/`,
  (q) => `https://en.wikipedia.org/wiki/${encodeURIComponent(q)}` // added Wikipedia images
];

const videoSites = [
  (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
  (q) => `https://vimeo.com/search?q=${encodeURIComponent(q)}`,
  (q) => `https://www.theguardian.com/uk/video` // example video section
];

// 🔹 Pick categories dynamically
function pickCategories(query) {
  const q = query.toLowerCase();
  if (q.includes("how to") || q.includes("software") || q.includes("programming")) return ["tech"];
  if (q.includes("health") || q.includes("biology") || q.includes("science")) return ["science"];
  if (q.includes("study") || q.includes("definition") || q.includes("school") || q.includes("education")) return ["education"];
  return ["general"];
}

// 🔹 Fetch HTML and parse with cheerio
async function fetchHTML(url) {
  try {
    const { data } = await axios.get(url, {
      headers: { "User-Agent": "FwebFcards/1.0 (+https://fweb.africa)" },
      timeout: 8000
    });
    return cheerio.load(data);
  } catch {
    return null;
  }
}

// 🔹 Crawl text (fcards)
export async function handleNormalSearch(query) {
  const categories = pickCategories(query);
  const selectedSources = categories.flatMap(cat => sourceCategories[cat]);

  const textResults = await Promise.all(selectedSources.map(async buildUrl => {
    const url = buildUrl(query);
    const $ = await fetchHTML(url);
    if (!$) return null;

    const title = $("title").first().text().trim() || url;
    const snippet = $("p").first().text().trim().substring(0, 200) || "No snippet available.";
    let favicon = $('link[rel="icon"]').attr("href") || $('link[rel="shortcut icon"]').attr("href") || "/favicon.ico";
    if (favicon && !favicon.startsWith("http")) favicon = new URL(favicon, url).href;

    return { type: "fcards", title, url, favicon, snippet };
  }));

  return textResults.filter(r => r);
}

// 🔹 Crawl images
export async function handleImagesSearch(query) {
  const results = [];

  for (const buildUrl of imageSites) {
    const url = buildUrl(query);
    const $ = await fetchHTML(url);
    if (!$) continue;

    // Universal image selector
    $("img").each((i, el) => {
      let src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src");
      const alt = $(el).attr("alt") || "Image";

      // Skip icons and tiny images
      if (src && !src.includes("sprite") && !src.includes("logo") && !src.includes("icon")) {
        // Fix relative URLs
        if (src.startsWith("//")) src = "https:" + src;
        if (src.startsWith("/")) src = new URL(src, url).href;
        results.push({ type: "image", src, title: alt });
      }
    });
  }

  return results;
}

// 🔹 Crawl videos
export async function handleVideoSearch(query) {
  const results = [];

  for (const buildUrl of videoSites) {
    const url = buildUrl(query);
    const $ = await fetchHTML(url);
    if (!$) continue;

    $("a").each((i, el) => {
      const href = $(el).attr("href");
      const title = $(el).attr("title") || $(el).text().trim() || "Video";

      // YouTube links
      if (href && href.startsWith("/watch")) results.push({ type: "video", title, url: "https://youtube.com" + href });

      // Vimeo links
      else if (href && href.includes("vimeo.com")) results.push({ type: "video", title, url: href });

      // Guardian video links (example)
      else if (href && href.includes("/video/")) results.push({ type: "video", title, url: "https://www.theguardian.com" + href });
    });
  }

  return results;
}

// 🔹 Combined search
export async function handleFullSearch(query) {
  const [fcards, images, videos] = await Promise.all([
    handleNormalSearch(query),
    handleImagesSearch(query),
    handleVideoSearch(query)
  ]);

  return { fcards, images, videos };
}
