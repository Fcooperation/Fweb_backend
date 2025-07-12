// index.js
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { URL } from 'url';

const visited = new Set();
const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
const base = 'https://en.wiktionary.org';

async function crawlWordPage(url) {
  if (visited.has(url)) return;
  visited.add(url);

  try {
    console.log(`🔗 Crawling word: ${url}`);
    const res = await fetch(url);
    if (!res.ok) return;

    const html = await res.text();
    const $ = cheerio.load(html);

    const title = $('title').text().trim();
    const preview = $('#mw-content-text').text().slice(0, 300).trim();

    console.log(`🧠 ${title}`);
    console.log(`📝 Preview: ${preview}\n`);
  } catch (err) {
    console.error(`❌ Failed to crawl ${url}: ${err.message}`);
  }
}

async function crawlCategoryLetter(letterUrl) {
  try {
    const res = await fetch(letterUrl);
    if (!res.ok) {
      console.log(`❌ Failed: ${res.status} ${letterUrl}`);
      return;
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const links = [];

    $('a[href^="/wiki/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (
        href &&
        !href.includes(':') && // Exclude special namespaces like Category, Talk, etc
        /^[a-zA-Z\-'.]+$/.test(href.replace('/wiki/', '')) // Allow words, hyphenated, and abbreviations
      ) {
        const fullUrl = new URL(href, base).toString();
        links.push(fullUrl);
      }
    });

    const uniqueLinks = [...new Set(links)];
    console.log(`🔎 Found ${uniqueLinks.length} valid word links\n`);

    for (const link of uniqueLinks.slice(0, 100)) {
      await crawlWordPage(link);
    }
  } catch (err) {
    console.error(`⚠️ Error crawling letter page: ${err.message}`);
  }
}

async function start() {
  for (const letter of alphabet) {
    const url = `${base}/wiki/Category:English_lemmas?from=${letter}`;
    await crawlCategoryLetter(url);
  }
}

start();
