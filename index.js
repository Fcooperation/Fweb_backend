import fs from 'fs';
import axios from 'axios';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import { nanoid } from 'nanoid';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';

// 🔐 Supabase credentials
const supabaseUrl = 'https://pwsxezhugsxosbwhkdvf.supabase.co';
const supabaseKey = 'your-real-key-here'; // Replace with your real key if not injected
const supabase = createClient(supabaseUrl, supabaseKey);

// 🎯 Educational-focused start points
const SITES = [
  // Wikipedia educational portals and outlines
  'https://en.wikipedia.org/wiki/Wikipedia:Contents',
  'https://en.wikipedia.org/wiki/Outline_of_academic_disciplines',
  'https://en.wikipedia.org/wiki/Portal:Science',
  'https://en.wikipedia.org/wiki/Portal:Technology',
  'https://en.wikipedia.org/wiki/Portal:Mathematics',
  'https://en.wikipedia.org/wiki/Portal:History',
  'https://en.wikipedia.org/wiki/Portal:Health_and_fitness',
  'https://en.wikipedia.org/wiki/Portal:Society',
  'https://en.wikipedia.org/wiki/Portal:Philosophy',
  'https://en.wikipedia.org/wiki/Portal:Engineering',

  // Open Library knowledge subjects
  'https://openlibrary.org/subjects/science',
  'https://openlibrary.org/subjects/technology',
  'https://openlibrary.org/subjects/history',
  'https://openlibrary.org/subjects/mathematics',

  // Scientific papers and journals
  'https://www.nature.com/subjects',
  'https://www.sciencedirect.com/journal/',
  'https://www.hindawi.com/journals/',
  'https://pubmed.ncbi.nlm.nih.gov/',
  'https://www.researchgate.net/',
];

// 🧠 Estimate token size
function countTokens(text) {
  return Math.ceil(text.length / 4);
}

// 🕒 Pause
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 📚 Extract text content from HTML
function extractTrainingData(html) {
  const $ = cheerio.load(html);
  const title = $('title').text().trim();
  let bodyText = '';
  $('p').each((_, el) => {
    const txt = $(el).text().trim();
    if (txt.length > 50) bodyText += txt + '\n';
  });
  return { title, content: bodyText.trim().slice(0, 5000) };
}

// 🚀 Upload training entry if not duplicate
async function uploadToSupabase(data) {
  try {
    const { data: existing } = await supabase
      .from('fai_training')
      .select('id')
      .eq('url', data.url)
      .limit(1);

    if (existing.length > 0) {
      console.log(`⚠️ Duplicate found, skipping: ${data.url}`);
      return false;
    }

    await supabase.from('fai_training').insert([data]).throwOnError();
    console.log(`📤 Uploaded: ${data.url}`);
    return true;
  } catch (err) {
    console.error('❌ Upload error:', err.message || err);
    return false;
  }
}

// 📌 Make sure table exists
async function ensureTable() {
  console.log('⚙️ Ensuring Supabase table...');
  const { error } = await supabase.from('fai_training').select('id').limit(1);
  if (!error) {
    console.log('✅ Table exists');
  } else {
    console.warn('⚠️ Table not found. Please create manually in Supabase SQL editor:');
    console.warn(`
CREATE TABLE public.fai_training (
  id TEXT PRIMARY KEY,
  url TEXT UNIQUE,
  title TEXT,
  content TEXT,
  tokens INT8,
  timestamp TIMESTAMPTZ
);`);
  }
}

// 🤖 Robots.txt parser
async function getRobots(url) {
  try {
    const robotsUrl = new URL('/robots.txt', url).href;
    const res = await axios.get(robotsUrl);
    const parser = robotsParser(robotsUrl, res.data);
    const delay = parser.getCrawlDelay('fcrawler') || 2000;
    return { parser, delay };
  } catch {
    return { parser: { isAllowed: () => true }, delay: 2000 };
  }
}

// 🌍 Set to keep track of visited
const visited = new Set();

// 🧭 Crawl one page + its links (up to 100 pages)
async function crawl(url, robots, delay, pageCount = { count: 0 }, maxPages = 100) {
  if (visited.has(url) || pageCount.count >= maxPages) return;
  if (!robots.parser.isAllowed(url, 'fcrawler')) return;

  visited.add(url);
  pageCount.count++;
  console.log(`🔍 Crawling: ${url}`);

  try {
    const res = await axios.get(url, { timeout: 10000 });
    const { title, content } = extractTrainingData(res.data);
    const tokens = countTokens(content);

    if (tokens < 100) {
      console.log(`⚠️ Skipped (weak content): ${url}`);
      return;
    }

    const entry = {
      id: nanoid(),
      url,
      title,
      content,
      tokens,
      timestamp: new Date().toISOString()
    };

    await uploadToSupabase(entry);

    // Follow valid internal links
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
      .filter(href => href && href.startsWith('http'));

    for (const link of links) {
      await sleep(delay);
      await crawl(link, robots, delay, pageCount, maxPages);
    }

  } catch (err) {
    console.warn(`❌ Failed: ${url} – ${err.message}`);
  }
}

// 🧠 Crawler runner
export async function runCrawler(sites = SITES) {
  console.log('🚀 crawlerA starting...');
  await ensureTable();
  for (const site of sites) {
    const robots = await getRobots(site);
    await crawl(site, robots, robots.delay);
  }
}

// 🔁 Allow standalone execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runCrawler();
}
