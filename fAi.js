// fAi.js
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import { URL } from 'url';

// 🔐 Supabase credentials
const supabaseUrl = 'https://rjvjzvixkexxyqfncsfk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqdmp6dml4a2V4eHlxZm5jc2ZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTUwMDcwODIsImV4cCI6MjAyMDU4MzA4Mn0.R4sCqM2BtGAg7PKAVWauy28lW32zDgDqjlX7nZXDbBI';
const supabase = createClient(supabaseUrl, supabaseKey);

// 🌐 Rich source sites
const SITES = [
  'https://en.wikipedia.org/wiki/Artificial_intelligence',
  'https://openlibrary.org/subjects/machine_learning',
  'https://www.britannica.com/technology/artificial-intelligence',
  'https://archive.org/details/texts',
  'https://www.nature.com/search?q=AI',
  'https://gutenberg.org/ebooks/subject/41', // science
];

// ⚙️ Core state
const visited = new Set();
let queue = [...SITES];
let totalTokens = 0;
const BACKUP_FILE = './crawled_backup.jsonl';

// 🧠 Estimate token count (approx. 1 token = 4 chars)
function countTokens(text) {
  return Math.ceil(text.length / 4);
}

// 🧠 Extract readable content
function extractKeyPoints(html) {
  const $ = cheerio.load(html);
  const title = $('title').text().trim();
  let text = '';
  $('p').each((_, el) => {
    const paragraph = $(el).text().trim();
    if (paragraph.length > 50) text += paragraph + '\n';
  });
  return { title, keypoints: text.trim().slice(0, 3000) };
}

// 📂 Save locally
function saveToFile(entry) {
  fs.appendFileSync(BACKUP_FILE, JSON.stringify(entry) + '\n');
}

// 🔍 Check if already in Supabase
async function alreadyCrawled(url) {
  const { data } = await supabase
    .from('fai_index')
    .select('id')
    .eq('url', url)
    .limit(1);
  return data && data.length > 0;
}

// 📤 Upload to Supabase
async function uploadToSupabase(data) {
  const { error } = await supabase.from('fai_index').insert([data]);
  if (error) {
    console.error('❌ Supabase upload error:', error.message);
    return false;
  }
  console.log(`✅ Uploaded: ${data.url}`);
  return true;
}

// 🏗️ Ensure Supabase table exists
async function ensureTable() {
  try {
    const ddl = `
      create table if not exists public.fai_index (
        id text primary key,
        url text unique,
        title text,
        keypoints text,
        tokens int,
        timestamp timestamptz
      );
    `;
    const { error } = await supabase.rpc('execute_sql', { sql: ddl });
    if (error) throw error;
    console.log('✅ Table ensured.');
  } catch (err) {
    console.warn("⚠️ Couldn't auto-create table. If it already exists, this is safe to ignore.");
  }
}

// 🔁 Crawl one page
async function crawl(url) {
  if (visited.has(url) || !url.startsWith('http')) return;
  visited.add(url);
  console.log(`🔍 Crawling ${url}`);

  try {
    if (await alreadyCrawled(url)) {
      console.log(`⚠️ Already crawled: ${url}`);
      return;
    }

    const res = await axios.get(url, { timeout: 10000 });
    const { title, keypoints } = extractKeyPoints(res.data);

    if (!keypoints || keypoints.length < 100) {
      console.log(`⚠️ Skipped (not enough content): ${url}`);
      return;
    }

    const tokens = countTokens(keypoints);
    totalTokens += tokens;

    const entry = {
      id: nanoid(),
      url,
      title,
      keypoints,
      tokens,
      timestamp: new Date().toISOString()
    };

    saveToFile(entry);
    await uploadToSupabase(entry);

    // 🔗 Queue more internal links
    const $ = cheerio.load(res.data);
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      try {
        const full = new URL(href, url).toString();
        if (!visited.has(full) && full.includes(new URL(url).hostname)) {
          queue.push(full);
        }
      } catch {}
    });

  } catch (err) {
    console.error(`❌ Error crawling ${url}: ${err.message}`);
  }
}

// 🚀 Main loop
async function run() {
  console.log('🚀 fAi starting...\n');
  await ensureTable();

  let idleCount = 0;

  while (queue.length > 0) {
    const next = queue.shift();
    console.log(`📥 Queue left: ${queue.length}`);
    const before = totalTokens;
    await crawl(next);

    if (totalTokens === before) {
      idleCount++;
    } else {
      idleCount = 0;
    }

    if (idleCount > 20) {
      console.log('⚠️ No progress detected. Re-seeding fresh sources.');
      queue.push(...SITES);
      idleCount = 0;
    }

    console.log(`📊 Total tokens scraped: ${totalTokens}`);
  }

  console.log('\n✅ Done crawling.\n🧠 Tokens collected:', totalTokens);
}

run();
