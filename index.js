// index.js
const express = require("express");
const axios = require("axios");
const { SentenceTransformer } = require("sentence-transformers/node");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
const model = new SentenceTransformer("all-MiniLM-L6-v2");

function splitIntoSentences(text) {
  return text.match(/[^.!?]+[.!?]+/g) || [];
}

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

app.post("/search", async (req, res) => {
  const query = req.body.query || "";
  if (!query) return res.json({ response: "Empty query." });

  const keyword = query.split(" ").slice(-1)[0]; // fallback page
  const title = keyword.charAt(0).toUpperCase() + keyword.slice(1);
  const url = `https://en.wikipedia.org/api/rest_v1/page/plain/${encodeURIComponent(title)}`;

  try {
    const wikiRes = await axios.get(url);
    const fullText = wikiRes.data;
    const sentences = splitIntoSentences(fullText).filter(s => s.length > 30);

    const embeddings = await model.encode([query, ...sentences]);
    const queryVec = embeddings[0];
    const sentenceVecs = embeddings.slice(1);

    const scored = sentenceVecs.map((vec, i) => ({
      text: sentences[i],
      score: cosineSimilarity(queryVec, vec)
    }));

    const sorted = scored.sort((a, b) => b.score - a.score);
    const best = sorted.slice(0, 3); // top 3 matches

    res.json({
      response: best[0]?.text || "No answer found.",
      related: best.slice(1).map(x => x.text),
      title,
      source: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`
    });
  } catch (e) {
    console.error("❌ Error:", e.message);
    res.json({ response: "❌ Not found.", error: e.message });
  }
});

app.listen(PORT, () => console.log(`✅ fAi Server running at http://localhost:${PORT}`));
