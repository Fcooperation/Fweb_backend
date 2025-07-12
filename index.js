// index.js
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { URL } from 'url';

const baseUrl = 'https://en.wiktionary.org';
const startUrl = `${baseUrl}/wiki/Category:English_lemmas`;
const visited = new Set();

async function crawlCategoryPage(url, limit = 1000) {
  let currentUrl = url;
  let count = 0;

  while (currentUrl && count < limit) {
    if (visited.has(currentUrl)) break;
    visited.add(currentUrl);

    console.log(`🔍 Crawling category page: ${currentUrl}`);
    try {
      const res = await fetch(currentUrl);
      const html = await res.text();
      const $ = cheerio.load(html);

      // Extract dictionary word links only (filter for /wiki/<word>)
      const wordLinks = [];
      $('#mw-pages a').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.startsWith('/wiki/') && !href.includes(':')) {
          const full = new URL(href, baseUrl).toString();
          if (!visited.has(full)) {
            wordLinks.push(full);
            visited.add(full);
          }
        }
      });

      console.log(`📚 Found ${wordLinks.length} word links`);

      // Visit each word page
      for (const link of wordLinks) {
        await crawlWordPage(link);
        count++;
        if (count >= limit) break;
      }

      // Find the next page in the category
      const nextHref = $('a:contains("next page")').attr('href');
      if (nextHref) {
        currentUrl = new URL(nextHref, baseUrl).toString();
      } else {
        currentUrl = null;
        console.log('✅ Reached end of category pages.');
      }
    } catch (err) {
      console.error(`❌ Error crawling ${currentUrl}: ${err.message}`);
      break;
    }
  }
}

async function crawlWordPage(url) {
  console.log(`🔗 Crawling word: ${url}`);
  try {
    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);
    const title = $('title').text();
    const definition = $('#mw-content-text').text().slice(0, 500).trim(); // first part

    console.log(`🧠 ${title}\n📝 Preview: ${definition.slice(0, 100)}...\n`);
  } catch (err) {
    console.error(`⚠️ Error fetching word page: ${url} - ${err.message}`);
  }
}

// Run the crawler
crawlCategoryPage(startUrl);
