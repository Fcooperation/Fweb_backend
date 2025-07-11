import axios from 'axios';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import { nanoid } from 'nanoid';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';
import http from 'http';

// 🟩 Supabase setup
const supabase = createClient(
  'https://pwsxezhugsxosbwhkdvf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ'
);

// 🔗 Word entry pages
const SITES = [
  "https://en.wiktionary.org/wiki/logic",
  "https://en.wiktionary.org/wiki/truth",
  "https://en.wiktionary.org/wiki/run",
  "https://en.wiktionary.org/wiki/structure",
  "https://en.wiktionary.org/wiki/idea",
  "https://en.wiktionary.org/wiki/thought",
  "https://en.wiktionary.org/wiki/light",
  "https://en.wiktionary.org/wiki/memory"
];

// 🧠 Track visited
const visited = new Set();

// 📦 Extract title and definitions
function extractTrainingData(html) {
  const $ = cheerio.load(html);
  const title = $('title').text().trim();
  let content = '';

  $('p').each((_, el) => {
    const txt = $(el).text().trim();
    if (txt.length > 5) content += txt + '\n';
  });

  return { title, content: content.trim() };
}

// 🔌 Check robots.txt
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

// 📍 Log to visited table
async function markVisited(url) {
  const { data: existing } = await supabase
    .from('fai_visited')
    .select('url')
    .eq('url', url)
    .limit(1);

  if (!existing || existing.length === 0) {
    await supabase.from('fai_visited').insert([{ url }]);
    console.log(`✅ Marked as visited: ${url}`);
  } else {
    console.log(`⚠️ Already visited: ${url}`);
  }
}

// 🕷️ Crawl individual page
async function crawl(url, robots, delay) {
  const cleanUrl = url.split('#')[0];
  if (visited.has(cleanUrl)) return;
  visited.add(cleanUrl);

  if (!robots.parser.isAllowed(cleanUrl, 'fcrawler')) {
    console.log(`🚫 Disallowed by robots.txt: ${cleanUrl}`);
    return;
  }

  try {
    console.log(`🔍 Crawling: ${cleanUrl}`);
    const res = await axios.get(cleanUrl);
    const { title, content } = extractTrainingData(res.data);
    const tokens = Math.ceil(content.length / 4);
    if (tokens < 1) return;

    console.log(`🧠 ${title} | ${tokens} tokens`);
    console.log(content.split('\n').slice(0, 2).join('\n') + '\n---');

    await markVisited(cleanUrl);

    // 👇 Optionally, extract more links (commented for now)
    /*
    const $ = cheerio.load(res.data);
    const links = $('a[href]').map((_, el) => $(el).attr('href')).get();
    const absoluteLinks = links.map(href => {
      try {
        return new URL(href, cleanUrl).href.split('#')[0];
      } catch { return null; }
    }).filter(Boolean);

    for (const link of absoluteLinks) {
      if (link.startsWith('https://en.wiktionary.org/wiki/')) {
        await new Promise(r => setTimeout(r, delay));
        await crawl(link, robots, delay);
      }
    }
    */

  } catch (err) {
    console.warn(`❌ Failed to crawl ${cleanUrl}: ${err.message}`);
  }
}

// 🚀 Start crawling
(async () => {
  console.log('🕷️ crawlerA booting...');

  const { data } = await supabase.from('fai_visited').select('url').limit(100000);
  data?.forEach(d => visited.add(d.url.split('#')[0]));
  console.log(`📚 Loaded ${visited.size} visited URLs`);

  for (const site of SITES) {
    const robots = await getRobots(site);
    await crawl(site, robots, robots.delay);
  }

  // 🔓 Port 10000
  const PORT = 10000;
  http.createServer((_, res) => {
    res.writeHead(200);
    res.end('crawlerA is running.\n');
  }).listen(PORT, () => {
    console.log(`🔓 Port opened on ${PORT}`);
  });
})();
