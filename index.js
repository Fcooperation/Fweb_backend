import express from "express";
import cors from "cors";
import { handleNormalSearch } from "./fcrawler.js"; // ← updated Fcards function
import { login } from "./faccount.js";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ------------------------------
// Logging middleware
// ------------------------------
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[INCOMING] ${req.method} ${req.url}`);

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
  });

  next();
});

// ------------------------------
// Helpers
// ------------------------------

// Bing Images
async function fetchImages(query, limit = 40) {
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&count=${limit}`;
  try {
    const response = await axios.get(url, { headers: { "User-Agent": "FwebBot/1.0" }, timeout: 8000 });
    const $ = cheerio.load(response.data);
    const images = [];
    $("a.iusc").each((i, el) => {
      if (images.length >= limit) return false;
      try {
        const m = $(el).attr("m");
        const data = JSON.parse(m);
        if (data?.murl) images.push({ url: data.murl, title: data.t || "" });
      } catch {}
    });
    return images;
  } catch (err) {
    console.error("❌ Image fetch failed:", err.message);
    return [];
  }
}

// YouTube Videos
async function fetchVideos(query, limit = 20) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  try {
    const response = await axios.get(url, { headers: { "User-Agent": "FwebBot/1.0" }, timeout: 8000 });
    const html = response.data;
    const videoUrls = [];
    const regex = /"videoId":"(.*?)"/g;
    let match;
    while ((match = regex.exec(html)) !== null && videoUrls.length < limit) {
      videoUrls.push({ url: `https://www.youtube.com/watch?v=${match[1]}`, title: "" });
    }
    return videoUrls;
  } catch (err) {
    console.error("❌ Video fetch failed:", err.message);
    return [];
  }
}

// ------------------------------
// Routes
// ------------------------------

// Health check
app.get("/health", (req, res) => res.status(200).send("ok"));

// Root
app.get("/", (req, res) => res.send("Fweb backend is running 🚀"));

// Unified Search (Web + Images + Videos)
app.get("/search", async (req, res) => {
  const query = req.query.q?.trim();
  if (!query) return res.status(400).json({ error: "No query provided" });

  try {
    const webResults = await handleNormalSearch(query); // Fcards
    const images = await fetchImages(query, 40);
    const videos = await fetchVideos(query, 20);

    res.json({ web: webResults, images, videos });
  } catch (err) {
    console.error("❌ Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

// Login
app.post("/login", async (req, res) => {
  console.log(`🔑 Login attempt: ${req.body.email}`);
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });

  try {
    const user = await login({ email, password });
    res.json({ success: true, user });
  } catch (err) {
    console.error("❌ Login error:", err.message);
    res.status(401).json({ error: err.message });
  }
});

// ------------------------------
// Global error handlers
// ------------------------------
process.on("unhandledRejection", (err) => console.error("❌ Unhandled Rejection:", err));
process.on("uncaughtException", (err) => console.error("❌ Uncaught Exception:", err));

// Start Server
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
