import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/search', async (req, res) => {
  const { query } = req.body;
  console.log('Received search query:', query);

  if (!query) return res.status(400).json({ error: 'No query provided' });

  const searchTerm = query.trim().replace(/\s+/g, '_');
  const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(searchTerm)}`;

  try {
    const { data: html } = await axios.get(wikiUrl);
    const $ = cheerio.load(html);

    // 🧠 Get first paragraph as summary
    const firstParagraph = $('#mw-content-text p').first().text().trim();

    // 🖼 Collect up to 20 images
    const imageUrls = [];
    $('#mw-content-text img').each((i, el) => {
      if (imageUrls.length >= 20) return false;
      const src = $(el).attr('src');
      if (src && !src.includes('icon') && !src.includes('logo')) {
        const full = src.startsWith('//') ? 'https:' + src : 'https://en.wikipedia.org' + src;
        imageUrls.push(full);
      }
    });

    // 📄 Collect up to 10 internal links for fcards
    const fcards = [];
    $('#mw-content-text a[href^="/wiki/"]').each((i, el) => {
      if (fcards.length >= 10) return false;
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href && text && !href.includes(':')) {
        fcards.push({
          title: text,
          url: 'https://en.wikipedia.org' + href,
          icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/Wikipedia-logo.png/50px-Wikipedia-logo.png'
        });
      }
    });

    return res.json({
      sentence: firstParagraph || 'No summary found.',
      images: imageUrls,
      web: fcards
    });
  } catch (err) {
    console.error('❌ Wikipedia crawl error:', err.message);
    return res.json({
      sentence: 'Not found.',
      images: [],
      web: []
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));
