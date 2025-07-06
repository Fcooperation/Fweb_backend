const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

function cleanText(text) {
  return text.toLowerCase().replace(/[^\w\s]/gi, '');
}

function scoreSentence(sentence, query) {
  const queryWords = new Set(cleanText(query).split(/\s+/));
  const sentenceWords = new Set(cleanText(sentence).split(/\s+/));
  let score = 0;
  queryWords.forEach(word => {
    if (sentenceWords.has(word)) score++;
  });
  return score;
}

async function getSmartCrawl(query) {
  console.log(`🔍 Smart crawling: "${query}"`);

  try {
    // Step 1: Search Wikipedia
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
      console.log(`❌ No match found for "${query}"`);
      return null;
    }

    const bestTitle = results[0].title;
    const pageUrl = `https://en.wikipedia.org/wiki/${bestTitle.replace(/ /g, '_')}`;

    console.log(`📄 Crawling Wikipedia: "${bestTitle}"`);

    // Step 2: Load the article page
    const { data: html } = await axios.get(pageUrl);
    const $ = cheerio.load(html);

    const allSentences = [];
    $('p').each((_, el) => {
      const text = $(el).text().trim();
      const split = text.split(/(?<=[.?!])\s+/).filter(s => s.length >= 30);
      allSentences.push(...split);
    });

    if (allSentences.length === 0) {
      console.log(`❌ No sentences found at: ${pageUrl}`);
      return null;
    }

    // Step 3: Score and pick best sentence
    const scored = allSentences.map(s => ({
      text: s,
      score: scoreSentence(s, query)
    })).sort((a, b) => b.score - a.score);

    const best = scored[0];
    const related = scored.slice(1, 4).map(s => s.text);

    return {
      main: best.text,
      related,
      source: pageUrl,
      title: bestTitle
    };
  } catch (err) {
    console.error(`❌ Crawl error for "${query}":`, err.message);
    return null;
  }
}

app.post('/search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Missing query.' });

  const data = await getSmartCrawl(query);
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
  console.log(`🚀 fAi backend ready at port ${PORT}`);
});
