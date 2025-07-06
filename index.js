const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

function findBestMatch(sentences, query) {
  const qWords = query.toLowerCase().split(/\s+/);
  const matches = sentences
    .map(s => ({
      text: s,
      score: qWords.reduce((acc, word) =>
        s.toLowerCase().includes(word) ? acc + 1 : acc, 0)
    }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return matches.length > 0 ? matches.map(m => m.text).slice(0, 3) : [];
}

async function getSmartSentenceCrawl(query) {
  console.log(`🔍 Searching smart: "${query}"`);

  try {
    const searchRes = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        list: 'search',
        srsearch: query,
        format: 'json',
      }
    });

    const results = searchRes.data.query.search;
    if (!results || results.length === 0) {
      return null;
    }

    const bestTitle = results[0].title;
    const pageUrl = `https://en.wikipedia.org/wiki/${bestTitle.replace(/ /g, '_')}`;
    console.log(`📄 Crawling Wikipedia: "${bestTitle}" → ${pageUrl}`);

    const { data: html } = await axios.get(pageUrl);
    const $ = cheerio.load(html);

    const allSentences = [];
    $('p').each((_, el) => {
      const text = $(el).text().trim();
      const split = text.split(/(?<=[.?!])\s+/).filter(s => s.length >= 30);
      allSentences.push(...split);
    });

    if (allSentences.length === 0) return null;

    const matched = findBestMatch(allSentences, query);
    const fallback = allSentences[0];

    return {
      main: matched[0] || fallback,
      related: matched.slice(1),
      source: pageUrl,
      title: bestTitle
    };
  } catch (err) {
    console.error(`❌ Smart crawl failed for "${query}":`, err.message);
    return null;
  }
}

app.post('/search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Missing query.' });

  const data = await getSmartSentenceCrawl(query);
  if (!data) {
    return res.json({
      response: `❌ Couldn't find anything for "${query}"`,
      related: [],
      source: null
    });
  }

  res.json({
    response: data.main,
    related: data.related,
    source: data.source,
    title: data.title
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Smart Fweb backend running on port ${PORT}`);
});
