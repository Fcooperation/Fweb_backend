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
  if (!query) return res.status(400).json({ error: 'No query provided.' });

  console.log(`🔎 Reading search: "${query}"`);
  console.log(`📄 Crawling Wikipedia for: "${query}"`);

  const searchUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(query.replace(/\s+/g, '_'))}`;

  try {
    const { data } = await axios.get(searchUrl);
    const $ = cheerio.load(data);

    // Grab the first meaningful paragraph
    const firstParagraph = $('p')
      .filter((_, el) => $(el).text().trim().length > 100)
      .first()
      .text()
      .trim();

    if (firstParagraph) {
      console.log(`✅ Found: ${query}`);
      return res.json({
        query,
        response: firstParagraph
      });
    } else {
      console.log(`❌ No content found in page for: ${query}`);
      return res.json({
        query,
        response: `❌ No readable content found for "${query}" on Wikipedia.`
      });
    }
  } catch (err) {
    console.error(`❌ Wikipedia crawl error for "${query}":`, err.message);
    return res.json({
      query,
      response: `❌ No Wikipedia page found for "${query}".`
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
