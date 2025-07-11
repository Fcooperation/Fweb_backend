// crawlerA.js
import axios from 'axios';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import { nanoid } from 'nanoid';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';

// 🔐 Supabase (your actual credentials)
const supabase = createClient(
  'https://pwsxezhugsxosbwhkdvf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ'
);

// 🌍 Start sites
const SITES = [
  'https://en.wikipedia.org/wiki/Category:Reference'
];

// 🧠 Memory of visited pages
const visited = new Set();

// 🧮 Token estimator
function countTokens(text) {
  return Math.ceil(text.length / 4);
}

// 🧹 Extract title & paragraph content
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

// 📤 Upload to Supabase
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

// 📜 robots.txt parser
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

// 🔁 Generic Fallback API Logic
async function fallbackAPI(url) {
  try {
    const fallbackUrls = [];

    const parsed = new URL(url);
    const base = parsed.origin;

    // Common fallback paths
    fallbackUrls.push(base + '/api');
    fallbackUrls.push(base + '/api/v1');
    fallbackUrls.push(url + '.json');
    fallbackUrls.push(url + '/summary');
    fallbackUrls.push(base + '/feeds');

    for (const fallback of fallbackUrls) {
      try {
        const res = await axios.get(fallback, { timeout: 4000 });
        if (typeof res.data === 'object') {
          const text = JSON.stringify(res.data, null, 2);
          return {
            title: `Fallback from ${fallback}`,
            content: text,
            url: fallback,
            tokens: countTokens(text)
          };
        }
      } catch {
        // Try next
      }
    }

    return null;
  } catch (err) {
    console.warn(`⚠️ Fallback API failed for ${url}: ${err.message}`);
    return null;
  }
}

// 🔁 Crawl single page
async function crawl(url, robots, delay) {
  if (visited.has(url)) return;
  visited.add(url);

  if (!robots.parser.isAllowed(url, 'fcrawler')) {
    console.log(`🚫 Disallowed by robots.txt: ${url}`);
    const fallback = await fallbackAPI(url);
    if (fallback && fallback.tokens > 0) {
      await uploadToSupabase({
        id: nanoid(),
        url: fallback.url,
        title: fallback.title,
        content: fallback.content,
        tokens: fallback.tokens,
        timestamp: new Date().toISOString()
      });
    }
    return;
  }

  try {
    console.log(`🔍 Crawling: ${url}`);
    const res = await axios.get(url);
    const { title, content } = extractTrainingData(res.data);
    const tokens = countTokens(content);
    if (tokens < 1) return;

    await uploadToSupabase({
      id: nanoid(),
      url,
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
          return new URL(href, url).href;
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .filter(href => href.startsWith('http'));

    for (const link of links) {
      await new Promise(r => setTimeout(r, delay));
      await crawl(link, robots, delay);
    }
  } catch (err) {
    console.warn(`❌ Failed to crawl ${url}: ${err.message}`);
  }
}

// 🚀 Launch crawler
(async () => {
  console.log('🕷️ crawlerA booting...');
  const { data } = await supabase.from('fai_visited').select('url').limit(100000);
  data?.forEach(d => visited.add(d.url));
  console.log(`📚 Loaded ${visited.size} visited URLs`);

  for (const site of SITES) {
    const robots = await getRobots(site);
    await crawl(site, robots, robots.delay);
  }
})();
