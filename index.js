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

// 🌍 Start site (general reference)
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

// 📤 Upload training data to Supabase
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

// 🧠 Fallback API (auto-detect by URL pattern)
async function fallbackAPI(url) {
  try {
    if (url.includes('Special:Random')) {
      const res = await axios.get('https://en.wikipedia.org/api/rest_v1/page/random/summary');
      return {
        title: res.data.title,
        content: res.data.extract,
        url: res.data.content_urls.desktop.page,
        tokens: countTokens(res.data.extract)
      };
    }

    if (url.includes('Special:RecentChanges')) {
      const res = await axios.get('https://en.wikipedia.org/w/api.php', {
        params: {
          action: 'query',
          list: 'recentchanges',
          format: 'json',
          rcprop: 'title|timestamp'
        }
      });

      const changes = res.data.query?.recentchanges || [];
      const content = changes.map(c => `• ${c.title} (${c.timestamp})`).join('\n');
      return {
        title: 'Recent Wikipedia Changes',
        content,
        url,
        tokens: countTokens(content)
      };
    }

    // future fallback support (non-hardcoded)
    return null;
  } catch (err) {
    console.warn(`⚠️ Fallback API failed for ${url}: ${err.message}`);
    return null;
  }
}

// 🔁 Crawl single URL
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

// 🚀 Start crawl
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
