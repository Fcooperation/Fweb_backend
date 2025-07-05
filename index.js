const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// POST /search endpoint
app.post('/search', async (req, res) => {
  const { query } = req.body;
  console.log('📥 Search query received:', query);

  try {
    const url = 'https://books.toscrape.com/catalogue/page-1.html';
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const results = [];

    $('.product_pod').each((i, el) => {
      const title = $(el).find('h3 a').attr('title');
      const price = $(el).find('.price_color').text();
      const link = 'https://books.toscrape.com/catalogue/' + $(el).find('h3 a').attr('href');

      if (title.toLowerCase().includes(query.toLowerCase())) {
        results.push({ title, price, link });
      }
    });

    console.log('📚 Found Results:', results);
    // 🛑 Don't send back to frontend (yet)
    res.status(204).end(); // No content
  } catch (err) {
    console.error('❌ Crawling error:', err.message);
    res.status(204).end(); // Still no content, but log the error
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Test crawler backend running on port ${PORT}`);
});
