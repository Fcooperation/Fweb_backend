const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const sentenceSplitter = text =>
  text.match(/[^\.!\?]+[\.!\?]+/g)?.map(s => s.trim()) || [];

const getBestMatchingSentence = (sentences, query) => {
  const queryWords = query.toLowerCase().split(/\W+/);
  let bestSentence = "";
  let bestScore = 0;

  for (const sentence of sentences) {
    let score = 0;
    const sentenceWords = sentence.toLowerCase().split(/\W+/);
    for (const word of queryWords) {
      if (sentenceWords.includes(word)) score++;
    }

    if (score > bestScore) {
      bestScore = score;
      bestSentence = sentence;
    }
  }

  return bestSentence;
};

app.post('/search', async (req, res) => {
  const { query } = req.body;
  console.log("🔎 Reading search:", query);

  try {
    const searchTerm = query.trim().toLowerCase().replace(/\s+/g, '_');
    const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(searchTerm)}`;
    console.log("📄 Crawling Wikipedia for:", query);

    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const text = $('#mw-content-text p').text().replace(/\d+/g, '');
    const sentences = sentenceSplitter(text);
    const bestMatch = getBestMatchingSentence(sentences, query);

    if (!bestMatch) {
      console.log(`❌ No matching sentence for: ${query}`);
      return res.json({ response: "❌ No result found for your query.", source: url });
    }

    console.log(`✅ Match found: ${bestMatch}`);
    res.json({
      response: bestMatch,
      source: url
    });
  } catch (err) {
    console.error(`❌ Error crawling Wikipedia:`, err.message);
    res.status(500).json({ response: "❌ Failed to crawl Wikipedia.", error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 fAi backend running on port ${PORT}`);
});
