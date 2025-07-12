// index.js
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import express from 'express';
import { URL } from 'url';

const visited = new Set();
const app = express();
const PORT = process.env.PORT || 10000;

const startUrl = 'https://en.wiktionary.org/wiki/apple';

async function crawl(url, depth = 2) {
  if (visited.has(url) || depth <= 0) return;
  visited.add(url);

  try {
    console.log(`🔍 Crawling: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`❌ Failed: ${response.status} ${url}`);
      return;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $('title').text();
    console.log(`🧠 Title: ${title}`);

    const links = [];
    $('a[href]').each((_, a) => {
      const href = $(a).attr('href');
      if (href && href.startsWith('/wiki/') && !href.includes(':')) {
        const fullUrl = new URL(href, url).toString();
        links.push(fullUrl);
      }
    });

    console.log(`🔗 Found ${links.length} links`);

    for (const link of links.slice(0, 5)) { // limit to 5 to avoid overload
      await crawl(link, depth - 1);
    }

  } catch (err) {
    console.error(`⚠️ Error crawling ${url}:`, err.message);
  }
}

// Start crawl
crawl(startUrl, 2);

// Keep the app alive with Express
app.get('/', (_, res) => {
  res.send('Crawler is running...');
});

app.listen(PORT, () => {
  console.log(`🔓 Port opened on ${PORT}`);
});
