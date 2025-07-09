import fs from 'fs';
import axios from 'axios';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import { nanoid } from 'nanoid';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';

// 🔐 Supabase setup
const supabaseUrl = 'https://pwsxezhugsxosbwhkdvf.supabase.co';
const supabaseKey = 'your-real-key-here'; // Replace with real key
const supabase = createClient(supabaseUrl, supabaseKey);

// 🎯 Start URLs
const SITES = [
  'https://en.wikipedia.org/wiki/Wikipedia:Contents',
  'https://en.wikipedia.org/wiki/Outline_of_academic_disciplines',
  'https://openlibrary.org/subjects/science',
  'https://www.nature.com/subjects'
];

// 📏 Token count
function countTokens(text) {
  return Math.ceil(text.length / 4);
}

// 💤 Delay
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 🧠 Extract title and paragraphs
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

// 📤 Upload training content
async function uploadToSupabase(data) {
  try {
    const { data: existing } = await supabase
      .from('fai_training')
      .select('id')
      .eq('url', data.url)
      .limit(1);

    if (existing && existing.length > 0) {
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

// ✅ Check if URL already visited
async function alreadyVisited(url) {
  try {
    const { data } = await supabase
      .from('fai_visited')
      .select('url')
      .eq('url', url)
      .limit(1);
    return data && data.length > 0;
  } catch {
    return false;
  }
}

// ➕ Mark URL as visited
async function markVisited(url) {
  try {
    await supabase.from('fai_visited').insert([{ url }]);
  } catch (err) {
    console.warn(`⚠️ Failed to mark visited: ${url}`);
  }
}

// 📋 Ensure required tables exist
async function ensureTables() {
  console.log('⚙️ Ensuring Supabase tables...');

  // Check fai_training
  const { error: trainingErr } = await supabase.from('fai_training').select('id').limit(1);
  if (trainingErr) {
    console.warn('⚠️ Table fai_training not found. Please run this:');
    console.warn(`
CREATE TABLE public.fai_training (
  id TEXT PRIMARY KEY,
  url TEXT UNIQUE,
  title TEXT,
  content TEXT,
  tokens INT8,
  timestamp TIMESTAMPTZ
);`);
  } else {
    console.log('✅ Table fai_training exists');
  }

  // Check fai_visited
  const { error: visitedErr } = await supabase.from('fai_visited').select('url').limit(1);
  if (visitedErr) {
    console.warn('⚠️ Table fai_visited not found. Please run this:');
    console.warn(`
CREATE TABLE public.fai_visited (
  url TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT now()
);`);
  } else {
    console.log('✅ Table fai_visited exists');
  }
}

// 🧭 Crawl logic
async function crawl(url, robots, delay, pageCount = { count: 0 }, maxPages = 100) {
  if (pageCount.count >= maxPages) return;
  if (!robots.parser.isAllowed(url, 'fcrawler')) return;

  const isVisited = await alreadyVisited(url);
  if (isVisited) {
    console.log(`⏭️ Skipping visited: ${url}`);
    return;
  }

  pageCount.count++;
  console.log(`🔍 Crawling: ${url}`);

  try {
    const res = await axios.get(url, { timeout: 10000 });
    const { title, content } = extractTrainingData(res.data);
    const tokens = countTokens(content);

    await markVisited(url); // Save visit even if content is weak

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

    // Follow more links
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

// 🚀 Main runner
export async function runCrawler(sites = SITES) {
  console.log('🚀 crawlerA starting...');
  await ensureTables();
  for (const site of sites) {
    const robots = await getRobots(site);
    await crawl(site, robots, robots.delay);
  }
}

// 🤖 robots.txt handler
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

// 🔁 If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCrawler();
}
