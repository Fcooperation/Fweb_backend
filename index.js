import express from 'express';
import axios from 'axios';
import cors from 'cors';
import { exec } from 'child_process';

import fs from 'fs';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import { nanoid } from 'nanoid';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// 🔐 Supabase credentials
const supabaseUrl = 'https://pwsxezhugsxosbwhkdvf.supabase.co';
const supabaseKey = 'your-real-key-here'; // Replace with your real key
const supabase = createClient(supabaseUrl, supabaseKey);

// 🎯 Educational-focused start points
const SITES = [
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
  'https://openlibrary.org/subjects/science',
  'https://openlibrary.org/subjects/technology',
  'https://openlibrary.org/subjects/history',
  'https://openlibrary.org/subjects/mathematics',
  'https://www.nature.com/subjects',
  'https://www.sciencedirect.com/journal/',
  'https://www.hindawi.com/journals/',
  'https://pubmed.ncbi.nlm.nih.gov/',
  'https://www.researchgate.net/',
];

// Token estimation
function countTokens(text) {
  return Math.ceil(text.length / 4);
}

// Sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Extract content
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

// Upload if not duplicate
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

// Ensure training table exists
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

// robots.txt handler
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

// Crawl logic
const visited = new Set();
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

// Start crawler
async function runCrawler(sites = SITES) {
  console.log('🚀 crawlerA starting...');
  await ensureTable();
  for (const site of sites) {
    const robots = await getRobots(site);
    await crawl(site, robots, robots.delay);
  }
}

// 🧠 Smart search API
function detectCategories(text) {
  const categories = [];
  const lower = text.toLowerCase();
  if (lower.includes('forum') || lower.includes('discussion')) categories.push('forums');
  if (lower.includes('news') || lower.includes('reported') || lower.includes('breaking')) categories.push('news');
  if (lower.includes('book') || lower.includes('novel') || lower.includes('published')) categories.push('books');
  return categories;
}

async function getSmartCrawl(query) {
  console.log(`🔍 Smart crawling: "${query}"`);

  try {
    const searchRes = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        list: 'search',
        srsearch: query,
        format: 'json',
      }
    });

    const results = searchRes.data.query.search;
    if (!results || results.length === 0) return null;

    const bestTitle = results[0].title;
    const summaryRes = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestTitle)}`);
    const summaryData = summaryRes.data;

    const main = summaryData.extract || "No summary found.";
    const image = summaryData.originalimage?.source || null;
    const source = summaryData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${bestTitle.replace(/ /g, "_")}`;
    const categories = detectCategories(main);

    return { main, image, title: bestTitle, source, categories };

  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    return null;
  }
}

// 📥 POST /search endpoint
app.post('/search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Missing query.' });

  const data = await getSmartCrawl(query);
  if (!data) {
    return res.json({
      response: `❌ Couldn't find anything for "${query}"`,
      related: [],
      images: [],
      categories: [],
      source: null
    });
  }

  res.json({
    response: data.main,
    related: [],
    images: data.image ? [data.image] : [],
    source: data.source,
    title: data.title,
    categories: data.categories
  });
});

// 📶 POST /online => trigger fAi.js logic
app.post('/online', async (req, res) => {
  console.log("📶 User is online — starting crawler...");
  await runCrawler(); // run directly (no child_process needed in single file)
  res.send('✅ fAi.js started from /online');
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 fAi backend running at port ${PORT}`);
});
