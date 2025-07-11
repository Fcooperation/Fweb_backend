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

// 🌍 Wiktionary-only entries
https://en.wiktionary.org/wiki/Category:English_lemmas

const visited = new Set();

function countTokens(text) {
  return Math.ceil(text.length / 4);
}

function extractTrainingData(html) {
  const $ = cheerio.load(html);
  const title = $('title').text().trim();
  let bodyText = '';
  $('p').each((_, el) => {
    const txt = $(el).text().trim();
    if (txt.length > 1) bodyText += txt + '\n';
  });
  return { title, content: bodyText.trim() };
}

async function uploadToSupabase(entry) {
  const { data: existing } = await supabase
    .from('fai_training')
    .select('id')
    .eq('url', entry.url)
    .limit(1);
  if (!existing || existing.length === 0) {
    await supabase.from('fai_training').insert([entry]);
    await supabase.from('fai_visited').insert([{ url: entry.url }]);
    console.log(`📤 Uploaded: ${entry.url}`);
  } else {
    console.log(`⚠️ Duplicate: ${entry.url}`);
  }
}

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
    const tokens = countTokens(content);
    if (tokens < 1) return;

    await uploadToSupabase({
      id: nanoid(),
      url: cleanUrl,
      title,
      content,
      tokens,
      timestamp: new Date().toISOString()
    });

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
      .filter(href => href.startsWith('https://en.wiktionary.org/wiki/'));

    for (const link of links) {
      await new Promise(r => setTimeout(r, delay));
      await crawl(link, robots, delay);
    }
  } catch (err) {
    console.warn(`❌ Failed to crawl ${cleanUrl}: ${err.message}`);
  }
}

// 🚀 Start server + then crawl
(async () => {
  // 🔓 Keep port open first
  const PORT = 10000;
  http.createServer((_, res) => {
    res.writeHead(200);
    res.end('wiktionary-crawler running on port 10000\n');
  }).listen(PORT, async () => {
    console.log(`🔓 Port opened on ${PORT}`);

    // 📚 Load history
    const { data } = await supabase.from('fai_visited').select('url').limit(100000);
    data?.forEach(d => visited.add(d.url.split('#')[0]));
    console.log(`📖 Loaded ${visited.size} visited URLs`);

    // 🕷️ Start crawl
    for (const site of SITES) {
      const robots = await getRobots(site);
      await crawl(site, robots, robots.delay);
    }
  });
})();
