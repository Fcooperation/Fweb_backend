import axios from 'axios';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';
import http from 'http';

// 🔐 Supabase connection
const supabase = createClient(
  'https://pwsxezhugsxosbwhkdvf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ'
);

// 🌍 Fallback test site (only if no visited history exists)
const DEFAULT_SITE = 'https://www.google.com/';
const visited = new Set();
const queue = [];

// 🧠 Load visited from Supabase
async function loadVisitedAndSeedQueue() {
  const { data, error } = await supabase
    .from('fai_visited')
    .select('url')
    .order('timestamp', { ascending: false })  // newest first
    .limit(10000);

  if (error) {
    console.error('❌ Error loading visited:', error.message);
    return;
  }

  data?.forEach(d => visited.add(d.url.split('#')[0]));

  if (data && data.length > 0) {
    console.log(`📚 Loaded ${data.length} visited URLs`);
    queue.push(...data.map(d => d.url));
  } else {
    console.log('📭 No visited URLs — seeding from scratch.');
    queue.push(DEFAULT_SITE);
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

// 🧭 Crawl a URL
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
    await supabase.from('fai_visited').insert([
      { url: cleanUrl, timestamp: new Date().toISOString() }
    ]);
    console.log(`✅ Visited saved: ${cleanUrl}`);

    // Extract links
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
      .filter(href => href.startsWith('http'))
      .filter(href => !visited.has(href));

    for (const link of links.slice(0, 10)) {
      queue.push(link);
    }

    // Crawl next
    while (queue.length > 0) {
      const next = queue.shift();
      await new Promise(r => setTimeout(r, delay));
      await crawl(next, robots, delay);
    }
  } catch (err) {
    console.warn(`❌ Failed to crawl ${cleanUrl}: ${err.message}`);
  }
}

// 🚀 Boot
(async () => {
  console.log('🕷️ crawlerA booting...');
  await loadVisitedAndSeedQueue();

  const robots = await getRobots(queue[0]);
  const delay = robots.delay;

  while (queue.length > 0) {
    const url = queue.shift();
    await crawl(url, robots, delay);
  }

  // 🟢 Keep server alive
  const PORT = process.env.PORT || 10000;
  http.createServer((_, res) => {
    res.writeHead(200);
    res.end('🟢 Crawler is running.\n');
  }).listen(PORT, () => {
    console.log(`🔓 Port opened on ${PORT}`);
  });
})();
