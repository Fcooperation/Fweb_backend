// index.js (ES Module)
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { URL } from 'url';

const visited = new Set();
const startUrl = 'https://en.wiktionary.org/wiki/Category:English_lemmas';

async function crawl(url, depth = 2) {
  if (visited.has(url) || depth <= 0) return;
  visited.add(url);

  try {
    console.log(`🔍 Crawling: ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`❌ Failed: ${res.status} ${url}`);
      return;
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const title = $('title').text();
    console.log(`🧠 Title: ${title}`);

    const links = [];

    $('a[href]').each((_, a) => {
      const href = $(a).attr('href');
      if (
        href &&
        href.startsWith('/wiki/') &&
        !href.includes(':') // Skip non-word pages
      ) {
        const fullUrl = new URL(href, url).toString();
        if (!visited.has(fullUrl)) {
          links.push(fullUrl);
        }
      }
    });

    console.log(`🔗 Found ${links.length} valid word links`);
    
    // Crawl only first 10 links per page to control load
    for (const link of links.slice(0, 10)) {
      await crawl(link, depth - 1);
    }
  } catch (err) {
    console.error(`⚠️ Error on ${url}:`, err.message);
  }
}

// Start crawling from the category page
crawl(startUrl, 3);
