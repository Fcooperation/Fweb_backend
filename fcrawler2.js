// fcrawler2.js
import axios from "axios";
import * as cheerio from "cheerio";

// 🔹 Trusted sources for text, images, videos
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

// 🔹 Hardcoded image/video-only sites (for completeness)
const imageSites = [
  (q) => `https://unsplash.com/s/photos/${encodeURIComponent(q)}`,
  (q) => `https://www.pexels.com/search/${encodeURIComponent(q)}/`,
  (q) => `https://pixabay.com/images/search/${encodeURIComponent(q)}/`
];

const videoSites = [
  (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
  (q) => `https://vimeo.com/search?q=${encodeURIComponent(q)}`
];

// 🔹 Pick categories dynamically
function pickCategories(query) {
  const q = query.toLowerCase();
  if (q.includes("how to") || q.includes("software") || q.includes("programming")) return ["tech"];
  if (q.includes("health") || q.includes("biology") || q.includes("science")) return ["science"];
  if (q.includes("study") || q.includes("definition") || q.includes("school") || q.includes("education")) return ["education"];
  return ["general"];
}

// 🔹 Fetch HTML safely
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

// 🔹 Crawl text, images, videos from a source
async function crawlSource(buildUrl, query) {
  const url = buildUrl(query);
  const $ = await fetchHTML(url);
  if (!$) return { fcards: [], images: [], videos: [] };

  // --- Text/Fcards ---
  const title = $("title").first().text().trim() || url;
  const snippet = $("p").first().text().trim().substring(0, 200) || "No snippet available.";
  let favicon = $('link[rel="icon"]').attr("href") || $('link[rel="shortcut icon"]').attr("href") || "/favicon.ico";
  if (favicon && !favicon.startsWith("http")) favicon = new URL(favicon, url).href;

  const fcards = [{ type: "fcards", title, url, favicon, snippet }];

  // --- Images ---
  const images = [];
  $("img").each((i, el) => {
    let src = $(el).attr("src") || $(el).attr("data-src");
    const alt = $(el).attr("alt") || "Image";
    if (src) {
      if (!src.startsWith("http")) src = new URL(src, url).href;
      images.push({ type: "image", src, title: alt });
    }
  });

  // --- Videos ---
  const videos = [];
  $("a").each((i, el) => {
    const href = $(el).attr("href");
    const title = $(el).attr("title") || $(el).text().trim() || "Video";
    if (!href) return;

    // YouTube / Vimeo / links containing video extensions
    if (href.includes("youtube.com/watch") || href.includes("vimeo.com") || href.endsWith(".mp4") || href.endsWith(".webm")) {
      let videoUrl = href.startsWith("http") ? href : new URL(href, url).href;
      videos.push({ type: "video", title, url: videoUrl });
    }
  });

  return { fcards, images, videos };
}

// 🔹 Full search
export async function handleFullSearch(query) {
  const categories = pickCategories(query);
  const sources = categories.flatMap(cat => sourceCategories[cat]);

  const results = await Promise.all(sources.map(src => crawlSource(src, query)));

  // Also crawl dedicated image/video sites
  const imageResults = await Promise.all(imageSites.map(src => crawlSource(src, query)));
  const videoResults = await Promise.all(videoSites.map(src => crawlSource(src, query)));

  // Combine results
  const fcards = results.flatMap(r => r.fcards);
  const images = [...results.flatMap(r => r.images), ...imageResults.flatMap(r => r.images)];
  const videos = [...results.flatMap(r => r.videos), ...videoResults.flatMap(r => r.videos)];

  return { fcards, images, videos };
}
