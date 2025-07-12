// ES Module format
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { URL } from 'url';

const visited = new Set(); // To track visited URLs

const startUrl = 'https://en.wiktionary.org/wiki/apple';

async function crawl(url, depth = 1) {
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

    // Log the page title
    const title = $('title').text();
    console.log(`🧠 Title: ${title}`);

    // Get and log links
    const links = [];
    $('a[href]').each((_, a) => {
      const href = $(a).attr('href');
      if (href && href.startsWith('/wiki/') && !href.includes(':')) {
        const fullUrl = new URL(href, url).toString();
        links.push(fullUrl);
      }
    });

    console.log(`🔗 Found ${links.length} links`);
    
    // Crawl the next links (limit depth to avoid infinite loop)
    for (const link of links.slice(0, 5)) { // Limit to first 5 for demo
      await crawl(link, depth - 1);
    }

  } catch (err) {
    console.error(`⚠️ Error crawling ${url}:`, err.message);
  }
}

crawl(startUrl, 2);
