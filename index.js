import axios from 'axios';
import * as cheerio from 'cheerio';
import { nanoid } from 'nanoid';
import robotsParser from 'robots-parser';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';
import http from 'http';

// Supabase setup
const supabase = createClient(
  'https://pwsxezhugsxosbwhkdvf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ'
);

// 🌍 Start point: Wiktionary lemmas
const SITES = [
  "https://en.wiktionary.org/wiki/Category:English_lemmas"
];

// 🧠 Memory of visited URLs
const visited = new Set();

// Helper: Token estimator
function countTokens(text) {
  return Math.ceil(text.length / 4);
}

// ❌ Blocked pattern check
function isUselessPage(url) {
  return [
    '/wiki/Help:', '/wiki/Special:', '/wiki/Category:',
    '/wiki/Wiktionary:', '/wiki/Talk:', '/wiki/User:',
    '/wiki/Template:', '/wiki/File:', '/wiki/MediaWiki:',
    '/wiki/Portal:', '/wiki/Main_Page', '/wiki/Privacy_policy',
    '/wiki/Contact', '/wiki/Community_portal'
  ].some(pattern => url.includes(pattern));
}

// Only extract useful text content
function extractUsefulText(html) {
  const $ = cheerio.load(html);
  const title = $('h1').first().text().trim();
  let text = '';

  // Extract definitions and etymologies
  $('h2, h3, h4, p, ol, ul, dl').each((_, el) => {
    const t = $(el).text().trim();
    if (t && t.length > 10) text += t + '\n';
  });

  return { title, content: text.trim() };
}

// Upload visited only
async function saveVisited(url) {
  const base = url.split('#')[0];
  if (visited.has(base)) return;
  visited.add(base);

  const { data: existing } = await supabase
    .from('fai_visited')
    .select('url')
    .eq('url', base)
    .limit(1);

  if (!existing || existing.length === 0) {
    await supabase.from('fai_visited').insert([{ url: base, timestamp: new Date().toISOString() }]);
    console.log(`✅ Marked as visited: ${base}`);
  } else {
    console.log(`⚠️ Already visited: ${base}`);
  }
}

// Parse robots.txt
async function getRobots(url) {
  try {
    const robotsUrl = new URL('/robots.txt', url).href;
    const res = await axios.get(robotsUrl);
    const parser = robotsParser(robotsUrl, res.data);
    const delay = parser.getCrawlDelay('fcrawler') || 1500;
    return { parser, delay };
  } catch {
    return { parser: { isAllowed: () => true }, delay: 1500 };
  }
}

// Crawl logic
async function crawl(url, robots, delay) {
  const cleanUrl = url.split('#')[0];
  if (visited.has(cleanUrl) || isUselessPage(cleanUrl)) return;

  visited.add(cleanUrl);

  if (!robots.parser.isAllowed(cleanUrl, 'fcrawler')) {
    console.log(`🚫 Disallowed: ${cleanUrl}`);
    return;
  }

  try {
    console.log(`🔍 Crawling: ${cleanUrl}`);
    const res = await axios.get(cleanUrl);
    const { title, content } = extractUsefulText(res.data);
    const tokens = countTokens(content);

    // Print summary only (we're NOT uploading to training yet)
    console.log(`🧠 ${title} | ${tokens} tokens`);
    if (content) console.log(content.split('\n').slice(0, 3).join('\n'));
    console.log('---');

    await saveVisited(cleanUrl);

    // Follow links (only to real dictionary pages)
    const $ = cheerio.load(res.data);
    const links = $('a[href]')
      .map((_, el) => $(el).attr('href'))
      .get()
      .map(href => {
        try {
          return new URL(href, cleanUrl).href.split('#')[0];
        } catch { return null; }
      })
      .filter(Boolean)
      .filter(link =>
        link.startsWith('https://en.wiktionary.org/wiki/') &&
        !isUselessPage(link)
      );

    for (const link of links) {
      await new Promise(res => setTimeout(res, delay));
      await crawl(link, robots, delay);
    }

  } catch (err) {
    console.warn(`❌ Error crawling ${cleanUrl}: ${err.message}`);
  }
}

// Main start
(async () => {
  console.log('🕷️ crawlerA booting...');
  const { data } = await supabase.from('fai_visited').select('url').limit(10000);
  data?.forEach(d => visited.add(d.url.split('#')[0]));
  console.log(`📚 Loaded ${visited.size} visited URLs`);

  for (const site of SITES) {
    const robots = await getRobots(site);
    await crawl(site, robots, robots.delay);
  }

  const PORT = process.env.PORT || 3000;
  http.createServer((_, res) => {
    res.writeHead(200);
    res.end('crawlerA is running.\n');
  }).listen(PORT, () => {
    console.log(`🔓 Port opened on ${PORT}`);
  });
})();
