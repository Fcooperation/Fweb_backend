const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/search', async (req, res) => {
  const { query } = req.body;

  console.log(`🔎 Reading search: "${query}"`);
  if (!query) {
    console.log('❌ Error: No search query provided');
    return res.status(400).json({ error: 'No query provided.' });
  }

  try {
    const url = 'https://books.toscrape.com/catalogue/page-1.html';
    console.log(`📄 Crawling site: ${url}`);

    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const results = [];

    $('.product_pod').each((i, el) => {
      const title = $(el).find('h3 a').attr('title');
      const price = $(el).find('.price_color').text();
      const href = $(el).find('h3 a').attr('href');
      const link = `https://books.toscrape.com/catalogue/${href}`;

      if (title && title.toLowerCase().includes(query.toLowerCase())) {
        results.push({ title, price, link });
      }
    });

    if (results.length === 0) {
      console.log(`❌ No books found for: "${query}"`);
      return res.json({
        mainAnswer: `❌ No books found for "${query}".`,
        otherAnswers: [],
        sources: []
      });
    }

    console.log(`✅ Found results for: "${query}"`);

    res.json({
      mainAnswer: `✅ Found: ${results[0].title} - ${results[0].price}`,
      otherAnswers: results.slice(1, 5).map(book => `${book.title} - ${book.price}`),
      sources: results.map(book => book.link)
    });
  } catch (err) {
    console.error(`❌ Error crawling book site: ${err.message}`);
    res.status(500).json({ error: 'Failed to crawl book site.' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
