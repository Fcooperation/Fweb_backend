// index.js
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import express from 'express';

const app = express();
const PORT = process.env.PORT || 10000;

// === SUPABASE SETUP ===
const SUPABASE_URL = 'https://pwsxezhugsxosbwhkdvf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const START_URL = "https://en.wiktionary.org/wiki/Category:English_lemmas";
let visited = new Set();

const bannedPatterns = [
  '/wiki/Wiktionary:', '/wiki/Help:', '/wiki/Special:', '/wiki/Category:',
  '/wiki/Talk:', '/wiki/User:', '/wiki/Template:', '/wiki/Module:',
  '/wiki/File:', '/wiki/MediaWiki:', '/wiki/Wikipedia:', '/wiki/Portal:',
  '/wiki/Privacy_policy', '/wiki/Contact', '/wiki/Community_portal', '/wiki/Main_Page'
];

function isUsefulLink(href) {
  if (!href.startsWith('http') && !href.startsWith('/wiki/')) return false;
  return !bannedPatterns.some(pattern => href.includes(pattern));
}

async function loadVisited() {
  const { data, error } = await supabase.from('fai_visited').select('url');
  if (data) {
    data.forEach(row => visited.add(row.url));
    console.log(`📚 Loaded ${visited.size} visited URLs`);
  }
}

async function saveVisited(url) {
  visited.add(url);
  await supabase.from('fai_visited').insert([{ url }]);
}

async function uploadToTraining(url, title, text, tokens) {
  await supabase.from('fai_training').insert([{ url, title, text, tokens }]);
  console.log(`🧠 Uploaded: ${title} | ${tokens} tokens`);
}

async function crawl(url) {
  if (visited.has(url)) {
    console.log(`⚠️ Already visited or skipped: ${url}`);
    return;
  }

  console.log(`🔍 Crawling: ${url}`);
  try {
    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);
    await saveVisited(url);

    // Extract meaningful training text
    let title = $('title').text().trim();
    let content = '';
    $('p, li, dd').each((_, el) => {
      content += $(el).text().trim() + '\n';
    });

    const tokens = content.split(/\s+/).length;
    if (tokens > 10 && content.length > 100) {
      await uploadToTraining(url, title, content, tokens);
    }

    // Follow more links (internal + external)
    const links = $('a[href]')
      .map((_, el) => $(el).attr('href'))
      .get()
      .map(href => href.startsWith('/') ? `https://en.wiktionary.org${href}` : href)
      .filter(href => isUsefulLink(href) && !visited.has(href));

    for (const link of links) {
      await crawl(link);
    }
  } catch (err) {
    console.log(`❌ Error crawling ${url}:`, err.message);
  }
}

app.listen(PORT, async () => {
  console.log(`🔓 Port opened on ${PORT}`);
  console.log('🕷️ crawlerA booting...');
  await loadVisited();
  await crawl(START_URL);
});
