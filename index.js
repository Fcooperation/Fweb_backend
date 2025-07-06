// index.js (fixed version without sentence-transformers)
const express = require("express");
const axios = require("axios");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Smart sentence extractor
function extractBestSentences(content, query) {
  const lines = content.split(/(?<=[.?!])\s+/).filter(l => l.length > 30);
  const matched = lines
    .map(s => ({
      text: s,
      score: s.toLowerCase().includes(query.toLowerCase()) ? 1 : 0
    }))
    .filter(s => s.score > 0);

  return {
    response: matched[0]?.text || lines[0] || "No content found.",
    related: matched.slice(1, 4).map(x => x.text)
  };
}

app.post("/search", async (req, res) => {
  const query = req.body.query || "";
  if (!query) return res.json({ response: "❌ Empty query." });

  const fallback = query.split(" ").slice(-1)[0];
  const pageTitle = fallback.charAt(0).toUpperCase() + fallback.slice(1);

  try {
    const wikiRes = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/plain/${pageTitle}`);
    const { response, related } = extractBestSentences(wikiRes.data, query);

    res.json({
      response,
      related,
      title: pageTitle,
      source: `https://en.wikipedia.org/wiki/${pageTitle}`
    });
  } catch (err) {
    res.json({ response: "❌ Not found.", error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ fAi backend running → http://localhost:${PORT}`);
});
