const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 📚 Crawl books.toscrape.com for matching titles
async function findBooks(query) {
  const BASE = 'https://books.toscrape.com/catalogue/page-';
  const results = [];
  const MAX_PAGES = 5;

  for (let i = 1; i <= MAX_PAGES; i++) {
    const url = `${BASE}${i}.html`;

    try {
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);

      $('.product_pod').each((_, el) => {
        const title = $(el).find('h3 a').attr('title') || '';
        const link = $(el).find('h3 a').attr('href') || '';
        const price = $(el).find('.price_color').text().trim();

        if (title.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            sentence: `📘 ${title} — Price: ${price}`,
            source: `https://books.toscrape.com/catalogue/${link}`
          });
        }
      });
    } catch (err) {
      console.error(`❌ Error scraping page ${i}:`, err.message);
    }
  }

  return results;
}

// 🔁 API endpoint to handle search
app.post('/search', async (req, res) => {
  const { query } = req.body;
  console.log('🔍 Received search query:', query);

  if (!query) {
    return res.status(400).json({ error: 'No query provided.' });
  }

  try {
    const found = await findBooks(query);

    if (!found || found.length === 0) {
      return res.json({
        mainAnswer: `❌ No books found for "${query}".`,
        otherAnswers: [],
        sources: []
      });
    }

    const mainAnswer = found[0].sentence;
    const otherAnswers = found.slice(1, 5).map(f => f.sentence);
    const sources = [...new Set(found.map(f => f.source))];

    res.json({ mainAnswer, otherAnswers, sources });
  } catch (err) {
    console.error('❌ Internal error:', err.message);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`📚 fAi + BooksToScrape server running on http://localhost:${PORT}`);
});
