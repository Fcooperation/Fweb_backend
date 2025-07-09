import fs from 'fs';
import axios from 'axios';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import { nanoid } from 'nanoid';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';

// 📌 Supabase credentials
const supabaseUrl = 'https://pwsxezhugsxosbwhkdvf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // truncated for safety
const supabase = createClient(supabaseUrl, supabaseKey);

// 🌍 Default start URLs
const SITES = [
  'https://archive.org/',
  'https://en.wikipedia.org/',
  'https://openlibrary.org/',
  'https://www.nature.com/',
  'https://www.britannica.com/',
  'https://gutenberg.org/',
  'https://pubmed.ncbi.nlm.nih.gov/',
  'https://www.researchgate.net/',
  'https://www.sciencedirect.com/',
  'https://www.hindawi.com/'
];

function countTokens(text) {
  return Math.ceil(text.length / 4);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

async function ensureTable() {
  console.log('⚙️ Ensuring Supabase table...');
  const { error } = await supabase.from('fai_training').select('id').limit(1);
  if (!error) {
    console.log('✅ Table exists');
  } else {
    console.warn('⚠️ Table not found. Please create it manually in Supabase SQL editor:');
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

const visited = new Set();
async function crawl(url, robots, delay, pageCount = { count: 0 }, maxPages = 10) {
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

    // Follow links
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

export async function runCrawler(sites = SITES) {
  console.log('🚀 crawlerA starting...');
  await ensureTable();
  for (const site of sites) {
    const robots = await getRobots(site);
    await crawl(site, robots, robots.delay);
  }
}

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runCrawler();
}
