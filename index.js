const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

async function searchWikipedia(query) {
  console.log(`🔎 Reading search: "${query}"`);

  try {
    // 1. Search Wikipedia
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
      console.log(`❌ No Wikipedia match for "${query}"`);
      return { main: null };
    }

    const bestTitle = results[0].title;
    const pageUrl = `https://en.wikipedia.org/wiki/${bestTitle.replace(/ /g, '_')}`;

    console.log(`📄 Crawling Wikipedia page: "${bestTitle}"`);

    // 2. Crawl the article
    const { data: html } = await axios.get(pageUrl);
    const $ = cheerio.load(html);

    const paragraphs = [];
    $('p').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length >= 40) {
        paragraphs.push(text);
      }
    });

    if (paragraphs.length === 0) {
      console.log(`❌ No useful content found in: ${pageUrl}`);
      return { main: null };
    }

    return {
      main: paragraphs[0],
      related: paragraphs.slice(1, 4),
      source: pageUrl,
      title: bestTitle
    };
  } catch (err) {
    console.error(`❌ Error crawling Wikipedia for "${query}":`, err.message);
    return { main: null };
  }
}

app.post('/search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Missing query.' });

  const wikiResult = await searchWikipedia(query);

  if (!wikiResult.main) {
    return res.json({
      response: `❌ Couldn't find anything about "${query}"`,
      related: [],
      source: null
    });
  }

  res.json({
    response: wikiResult.main,
    related: wikiResult.related,
    source: wikiResult.source,
    title: wikiResult.title
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Fweb backend running on port ${PORT}`);
});
