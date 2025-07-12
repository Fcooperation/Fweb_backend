import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { URL } from 'url';

const visited = new Set();

// Crawl A–Z lemma categories
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const baseCategoryURL = 'https://en.wiktionary.org/wiki/Category:English_lemmas_starting_with_';

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
        !href.includes(':') // skip meta/help/etc
      ) {
        const fullUrl = new URL(href, url).toString();
        if (!visited.has(fullUrl)) {
          links.push(fullUrl);
        }
      }
    });

    console.log(`🔗 Found ${links.length} valid word links`);

    for (const link of links.slice(0, 10)) {
      await crawl(link, depth - 1);
    }

  } catch (err) {
    console.error(`⚠️ Error on ${url}:`, err.message);
  }
}

(async () => {
  for (const letter of letters) {
    const url = `${baseCategoryURL}${letter}`;
    await crawl(url, 2); // Crawl each letter category
  }
})();

// 🛑 Prevent premature Render app exit
setInterval(() => {}, 1000);
