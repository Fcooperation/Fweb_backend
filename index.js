const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

async function searchWikipedia(query) {
  try {
    console.log(`🔎 Reading search: "${query}"`);

    // Step 1: Use Wikipedia's search API to get the best page
    const searchRes = await axios.get(`https://en.wikipedia.org/w/api.php`, {
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
      return { main: null, related: [] };
    }

    const bestTitle = results[0].title;
    const pageUrl = `https://en.wikipedia.org/wiki/${bestTitle.replace(/ /g, '_')}`;

    console.log(`📄 Crawling Wikipedia page: "${bestTitle}"`);

    // Step 2: Fetch the page and extract paragraphs
    const { data: html } = await axios.get(pageUrl);
    const $ = cheerio.load(html);

    const paragraphs = [];
    $('p').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length >= 40) {
        paragraphs.push(text);
      }
    });

    if (paragraphs.length === 0) {
      console.log(`❌ No content found in page for: ${query}`);
      return { main: null, related: [] };
    }

    const main = paragraphs[0];
    const related = paragraphs.slice(1, 4);

    return { main, related, url: pageUrl, title: bestTitle };
  } catch (err) {
    console.error(`❌ Wikipedia crawl error for "${query}":`, err.message);
    return { main: null, related: [] };
  }
}

// 🚀 Endpoint
app.post('/search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'No query provided' });

  const { main, related, url, title } = await searchWikipedia(query);

  if (!main) {
    return res.json({
      response: `❌ No result found for "${query}".`,
      query,
      related: [],
      link: null
    });
  }

  res.json({
    response: main,
    query,
    related,
    link: url,
    title
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
