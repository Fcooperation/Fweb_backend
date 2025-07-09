import fs from 'fs';
import axios from 'axios';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import { nanoid } from 'nanoid';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';

// 🔐 Supabase credentials
const supabaseUrl = 'https://pwsxezhugsxosbwhkdvf.supabase.co';
const supabaseKey = 'YOUR_SUPABASE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

// 🌍 Start URLs
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

// 🔢 Count tokens
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

// 🔍 Check if URL was already visited
async function wasVisited(url) {
  const { data, error } = await supabase
    .from('fai_visited')
    .select('url')
    .eq('url', url)
    .limit(1);
  return data && data.length > 0;
}

// ✅ Log URL as visited
async function markVisited(url) {
  await supabase.from('fai_visited').insert([{ url }]).catch(() => {});
}

// 📤 Upload training data with duplicate check
async function uploadToSupabase(data) {
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
}

// 🧱 Ensure training table exists
async function ensureTables() {
  console.log('⚙️ Checking Supabase tables...');
  await supabase.from('fai_training').select('id').limit(1).catch(() => {});
  await supabase.from('fai_visited').select('url').limit(1).catch(() => {});
}

// 🤖 Get robots.txt info
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

// 🔁 Crawl pages
async function crawl(url, robots, delay, pageCount = { count: 0 }, maxPages = 10) {
  if (pageCount.count >= maxPages) return;
  if (!robots.parser.isAllowed(url, 'fcrawler')) return;

  const visitedBefore = await wasVisited(url);
  if (visitedBefore) {
    console.log(`⚠️ Already visited, skipping: ${url}`);
    return;
  }

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
    await markVisited(url); // ✅ Save visited

    // Extract links
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

// 🚀 Main
export async function runCrawler(sites = SITES) {
  console.log('🚀 crawlerA starting...');
  await ensureTables();
  for (const site of sites) {
    const robots = await getRobots(site);
    await crawl(site, robots, robots.delay);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCrawler();
}
