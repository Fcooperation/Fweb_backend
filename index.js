import axios from 'axios';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import { URL } from 'url';
import robotsParser from 'robots-parser';
import http from 'http';

// Supabase credentials
const supabase = createClient(
  'https://pwsxezhugsxosbwhkdvf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ'
);

// Start site
const START_URL = 'https://en.wiktionary.org/wiki/Category:English_lemmas';

// Skip patterns
const SKIP_PATTERNS = [
  '/wiki/Wiktionary:',
  '/wiki/Help:',
  '/wiki/Special:',
  // '/wiki/Category:',  ← TEMPORARILY COMMENTED OUT TO ALLOW LEMMA CRAWLING
  '/wiki/Talk:',
  '/wiki/User:',
  '/wiki/Template:',
  '/wiki/Module:',
  '/wiki/File:',
  '/wiki/MediaWiki:',
  '/wiki/Wikipedia:',
  '/wiki/Portal:',
  '/wiki/Privacy_policy',
  '/wiki/Contact',
  '/wiki/Main_Page',
];

// Visited memory
const visited = new Set();

// Token estimator
function countTokens(text) {
  return Math.ceil(text.length / 4);
}

// Clean and extract training data
function extractTrainingData(html) {
  const $ = cheerio.load(html);
  const title = $('title').first().text().trim().replace(/ - Wiktionary.*$/, '');
  let content = '';
  $('p').each((_, el) => {
    const txt = $(el).text().trim();
    if (txt.length > 1) content += txt + '\n';
  });
  return { title, content: content.trim() };
}

// Upload to visited table
async function markVisited(url) {
  await supabase.from('fai_visited').insert([{ url, timestamp: new Date().toISOString() }]);
}

// Robots.txt and crawl delay
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

// Crawl single page
async function crawl(url, robots, delay) {
  const cleanUrl = url.split('#')[0];
  if (visited.has(cleanUrl)) return;
  if (!robots.parser.isAllowed(cleanUrl, 'fcrawler')) return;

  if (SKIP_PATTERNS.some(pattern => cleanUrl.includes(pattern))) return;

  try {
    console.log(`🔍 Crawling: ${cleanUrl}`);
    const res = await axios.get(cleanUrl);
    const { title, content } = extractTrainingData(res.data);
    const tokens = countTokens(content);
    if (tokens < 5) return;

    console.log(`🧠 Uploaded: ${title} | ${tokens} tokens`);
    await markVisited(cleanUrl);

    const $ = cheerio.load(res.data);
    const links = $('a[href]')
      .map((_, el) => $(el).attr('href'))
      .get()
      .map(href => {
        try {
          return new URL(href, cleanUrl).href.split('#')[0];
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .filter(link => link.startsWith('https://en.wiktionary.org/wiki/'))
      .filter(link => !visited.has(link));

    for (const link of links) {
      await new Promise(r => setTimeout(r, delay));
      await crawl(link, robots, delay);
    }
  } catch (err) {
    console.warn(`❌ Failed to crawl ${cleanUrl}: ${err.message}`);
  }
}

// Start crawling
(async () => {
  console.log('🕷️ crawlerA booting...');
  const { data } = await supabase.from('fai_visited').select('url').limit(100000);
  data?.forEach(d => visited.add(d.url));
  console.log(`📚 Loaded ${visited.size} visited URLs`);

  const robots = await getRobots(START_URL);
  await crawl(START_URL, robots, robots.delay);

  // Keep port open for Render
  const PORT = process.env.PORT || 10000;
  http.createServer((_, res) => {
    res.writeHead(200);
    res.end('crawlerA is running.\n');
  }).listen(PORT, () => {
    console.log(`🔓 Port opened on ${PORT}`);
  });
})();
