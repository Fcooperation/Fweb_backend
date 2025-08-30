// index.js
import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import cors from 'cors';
import { URL } from 'url';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Utility to check if a string is a URL
function isValidUrl(str) {
  try {
    new URL(str.startsWith('http') ? str : 'http://' + str);
    return true;
  } catch {
    return false;
  }
}

// Function to crawl page in block format
async function crawlUrl(url) {
  try {
    if (!url.startsWith('http')) url = 'http://' + url; // prepend if missing
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const blocks = [];

    // Grab basic text blocks
    $('p, h1, h2, h3, h4, h5, h6, li, img, a').each((i, el) => {
      const tag = el.tagName;
      if (tag === 'img') {
        blocks.push({ type: 'img', src: $(el).attr('src'), alt: $(el).attr('alt') || '' });
      } else if (tag === 'a') {
        blocks.push({ type: 'link', href: $(el).attr('href'), text: $(el).text() });
      } else {
        blocks.push({ type: 'text', tag, content: $(el).text().trim() });
      }
    });

    // Grab favicon if exists
    const favicon = $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href') || null;

    return { folder: 'site', page: 'subsites', url, favicon, blocks };
  } catch (err) {
    return { error: 'Failed to crawl URL', message: err.message };
  }
}

app.post('/search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'No query provided' });

  try {
    // If the query is a URL, crawl it
    if (isValidUrl(query)) {
      const siteData = await crawlUrl(query);
      return res.json(siteData);
    }

    // Otherwise, perform normal search (DuckDuckGo HTML)
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await axios.get(searchUrl);
    res.json({ html: response.data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Fweb backend running on port ${PORT}`));
