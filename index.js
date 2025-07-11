import axios from 'axios';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import { nanoid } from 'nanoid';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';
import http from 'http';

const supabase = createClient(
  'https://pwsxezhugsxosbwhkdvf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ'
);

// 🌐 Start site
const SITES = ['https://en.wiktionary.org/wiki/apple'];
const visited = new Set();

// ⚠️ Skip patterns
const SKIP_PATTERNS = [
  '/wiki/Wiktionary:', '/wiki/Help:', '/wiki/Special:', '/wiki/Category:',
  '/wiki/Talk:', '/wiki/User:', '/wiki/Template:', '/wiki/Module:',
  '/wiki/File:', '/wiki/MediaWiki:', '/wiki/Wikipedia:', '/wiki/Portal:',
  '/wiki/Privacy_policy', '/wiki/Contact', '/wiki/Community_portal', '/wiki/Main_Page'
];

// 🧠 Token count estimator
function countTokens(text) {
  return Math.ceil(text.length / 4);
}

// 📚 Extract useful content only
function extractTrainingData(html) {
  const $ = cheerio.load(html);
  const title = $('#firstHeading').text().trim();
  let definitionText = '';

  $('#mw-content-text > div.mw-parser-output').children().each((_, el) => {
    const tag = el.tagName?.toLowerCase() || '';
    if (tag === 'p' || tag === 'ol' || tag === 'ul') {
      const txt = $(el).text().trim();
      if (txt.length > 2) definitionText += txt + '\n';
    }
  });

  return { title, content: definitionText.trim() };
}

// 📤 Upload to Supabase
async function uploadToSupabase(entry) {
  const { data: existing } = await supabase
    .from('fai_training')
    .select('id')
    .eq('url', entry.url)
    .limit(1);

  if (!existing || existing.length === 0) {
    await supabase.from('fai_training').insert([entry]);
    console.log(`🧠 Uploaded: ${entry.title} | ${entry.tokens} tokens`);
  } else {
    console.log(`⚠️ Already uploaded: ${entry.url}`);
  }

  await supabase.from('fai_visited').insert([{ url: entry.url, timestamp: new Date().toISOString() }]);
}

// 🧾 Robots.txt fetcher
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

// 🚫 Skip unwanted pages
function shouldSkip(url) {
  return SKIP_PATTERNS.some(p => url.includes(p));
}

// 🔁 Crawl one URL
async function crawl(url, robots, delay) {
  const cleanUrl = url.split('#')[0];
  if (visited.has(cleanUrl) || shouldSkip(cleanUrl)) return;
  if (!robots.parser.isAllowed(cleanUrl, 'fcrawler')) return;

  visited.add(cleanUrl);
  console.log(`🔍 Crawling: ${cleanUrl}`);

  try {
    const res = await axios.get(cleanUrl);
    const { title, content } = extractTrainingData(res.data);
    const tokens = countTokens(content);

    if (tokens > 1 && title && content) {
      await uploadToSupabase({
        id: nanoid(),
        url: cleanUrl,
        title,
        content,
        tokens,
        timestamp: new Date().toISOString()
      });
    }

    const $ = cheerio.load(res.data);
    const links = $('a[href]')
      .map((_, el) => $(el).attr('href'))
      .get()
      .map(href => {
        try {
          const full = new URL(href, cleanUrl).href;
          return full.split('#')[0];
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .filter(href => href.startsWith('https://en.wiktionary.org/wiki/'));

    for (const link of links) {
      await new Promise(r => setTimeout(r, delay));
      await crawl(link, robots, delay);
    }
  } catch (err) {
    console.warn(`❌ Failed to crawl ${cleanUrl}: ${err.message}`);
  }
}

// 🟢 Main runner
(async () => {
  console.log('🕷️ crawlerA booting...');
  const { data } = await supabase.from('fai_visited').select('url').limit(10000);
  data?.forEach(d => visited.add(d.url.split('#')[0]));
  console.log(`📚 Loaded ${visited.size} visited URLs`);

  for (const site of SITES) {
    const robots = await getRobots(site);
    await crawl(site, robots, robots.delay);
  }

  const PORT = process.env.PORT || 10000;
  http.createServer((_, res) => {
    res.writeHead(200);
    res.end('crawlerA is running.\n');
  }).listen(PORT, () => {
    console.log(`🔓 Port opened on ${PORT}`);
  });
})();
