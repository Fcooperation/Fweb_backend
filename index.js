// index.js
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import { JSDOM } from 'jsdom';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Crawl endpoint
app.post('/crawl', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No URL provided' });

  try {
    // Fetch the site
    const response = await fetch(url);
    const html = await response.text();

    // Parse the DOM
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Extract content blocks
    const blocks = [];
    document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, img, video, audio, pre, code, li').forEach(el => {
      if (el.tagName.toLowerCase() === 'img') {
        blocks.push({ type: 'image', src: el.src });
      } else if (el.tagName.toLowerCase() === 'video') {
        blocks.push({ type: 'video', src: el.src });
      } else if (el.tagName.toLowerCase() === 'audio') {
        blocks.push({ type: 'audio', src: el.src });
      } else {
        blocks.push({ type: 'text', tag: el.tagName.toLowerCase(), content: el.textContent.trim() });
      }
    });

    console.log(`Crawled ${url}, extracted ${blocks.length} blocks`);

    // Instead of sending content, just confirm completion
    res.json({ message: 'done crawling' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Fweb backend running on port ${PORT}`));
