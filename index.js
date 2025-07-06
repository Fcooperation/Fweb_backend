const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();
app.use(cors());
app.use(express.json());

function cleanText(text) {
  return text.replace(/\d+/g, '').trim(); // remove [1], [2] etc.
}

function getWikiUrl(query) {
  const title = query
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
    .split(' ')
    .slice(-1)[0]; // last word
  const full = query.replace(/ /g, '_');
  return [`https://en.wikipedia.org/wiki/${full}`, `https://en.wikipedia.org/wiki/${title}`];
}

function findBestSentence(query, sentences) {
  const q = query.toLowerCase();
  return sentences
    .map((s, i) => ({ text: s, score: s.toLowerCase().includes(q) ? 2 : s.toLowerCase().split(q).length > 1 ? 1 : 0, index: i }))
    .filter(obj => obj.score > 0)
    .sort((a, b) => b.score - a.score)[0];
}

app.post('/search', async (req, res) => {
  const query = req.body.query;
  console.log('🔎 Reading search:', query);

  const urls = getWikiUrl(query);

  for (let url of urls) {
    try {
      console.log('📄 Crawling Wikipedia for:', url);
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      const paragraphs = [];
      $('p').each((i, el) => {
        const text = cleanText($(el).text());
        if (text.length > 50) paragraphs.push(text);
      });

      const allSentences = paragraphs.flatMap(p => p.split('. ').map(s => cleanText(s + '.')));

      const match = findBestSentence(query, allSentences);

      if (!match) continue;

      const related = allSentences.slice(match.index + 1, match.index + 5).filter(s => s.length < 300);

      return res.json({
        response: match.text,
        related,
        source: url,
        title: decodeURIComponent(url.split('/').pop())
      });
    } catch (err) {
      console.log(`❌ Wikipedia crawl error for "${query}":`, err.message);
    }
  }

  return res.json({
    response: "❌ No result found.",
    related: [],
    source: null,
    title: null
  });
});

app.listen(3000, () => console.log('✅ Fweb AI running on port 3000'));
