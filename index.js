import axios from 'axios';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import { nanoid } from 'nanoid';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';
import http from 'http';

// 🔐 Supabase credentials
const supabase = createClient(
  'https://pwsxezhugsxosbwhkdvf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ'
);

// 🌐 Starting point
const START_URL = 'https://en.wiktionary.org/wiki/apple';
const visited = new Set();

// ❌ Pages we want to skip
const SKIP_PATTERNS = [
  '/wiki/Wiktionary:', '/wiki/Help:', '/wiki/Special:', '/wiki/Category:',
  '/wiki/Talk:', '/wiki/User:', '/wiki/Template:', '/wiki/Module:',
  '/wiki/File:', '/wiki/MediaWiki:', '/wiki/Wikipedia:', '/wiki/Portal:',
  '/wiki/Privacy_policy', '/wiki/Contact', '/wiki/Community_portal',
  '/wiki/Main_Page', '/wiki/Appendix:', '/wiki/Appendix_talk:'
];

// 🧮 Token estimator
function countTokens(text) {
  return Math.ceil(text.length / 4);
}

// 🧠 Extract training data
function extractTrainingData(html) {
  const $ = cheerio.load(html);
  const title = $('h1').first().text().trim();
  let content = '';

  $('#mw-content-text p, #mw-content-text ul, #mw-content-text ol').each((_, el) => {
    const txt = $(el).text().trim();
    if (txt.length > 1) content += txt + '\n';
  });

  return { title, content: content.trim() };
}

// 🔽 Load previously visited URLs
async function loadVisited() {
  const { data, error } = await supabase.from('fai_visited').select('url').limit(100000);
  if (error) {
    console.error('❌ Failed to load visited:', error.message);
    return;
  }
  data.forEach(d => visited.add(d.url.split('#')[0]));
  console.log(`📚 Loaded ${visited.size} visited URLs`);
}

// 📤 Upload visited only
async function markVisited(url) {
  await supabase.from('fai_visited').insert([{ url }]);
  console.log(`✅ Marked as visited: ${url}`);
}

// 🧹 Should skip page?
function shouldSkip(url) {
  return SKIP_PATTERNS.some(pattern => url.includes(pattern));
}

// 🔁 Crawl a URL
async function crawl(url, robots, delay) {
  const cleanUrl = url.split('#')[0];
  if (visited.has(cleanUrl) || shouldSkip(cleanUrl)) {
    console.log(`⚠️ Already visited or skipped: ${cleanUrl}`);
    return;
  }
  visited.add(cleanUrl);

  if (!robots.parser.isAllowed(cleanUrl, 'fcrawler')) {
    console.log(`🚫 Blocked by robots.txt: ${cleanUrl}`);
    return;
  }

  try {
    console.log(`🔍 Crawling: ${cleanUrl}`);
    const res = await axios.get(cleanUrl);
    const { title, content } = extractTrainingData(res.data);
    const tokens = countTokens(content);
    if (tokens < 10 || !content) return;

    await supabase.from('fai_training').insert([{
      id: nanoid(),
      url: cleanUrl,
      title,
      content,
      tokens,
      timestamp: new Date().toISOString()
    }]);

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
      .filter(link => link.startsWith('https://en.wiktionary.org/wiki/'));

    for (const link of links) {
      await new Promise(r => setTimeout(r, delay));
      await crawl(link, robots, delay);
    }
  } catch (err) {
    console.warn(`❌ Failed: ${cleanUrl} => ${err.message}`);
  }
}

// 📜 Get robots.txt
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

// 🚀 Main
(async () => {
  console.log('🕷️ crawlerA booting...');
  await loadVisited();
  const robots = await getRobots(START_URL);
  await crawl(START_URL, robots, robots.delay);

  // 📡 Open port
  const PORT = process.env.PORT || 10000;
  http.createServer((_, res) => {
    res.writeHead(200);
    res.end('crawlerA is running.\n');
  }).listen(PORT, () => {
    console.log(`🔓 Port opened on ${PORT}`);
  });
})();
