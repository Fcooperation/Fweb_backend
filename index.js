const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

async function getSentenceCrawl(query) {
  console.log(`🔎 Sentence crawling: "${query}"`);

  try {
    // Search Wikipedia
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

    // Get the article
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

    const main = allSentences[0];
    const related = allSentences.slice(1, 4);

    return {
      main,
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

  const data = await getSentenceCrawl(query);
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
  console.log(`🚀 Fweb backend ready at port ${PORT}`);
});
