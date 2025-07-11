import axios from 'axios';
import * as cheerio from 'cheerio';
import { nanoid } from 'nanoid';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';
import http from 'http';

const supabase = createClient(
  'https://pwsxezhugsxosbwhkdvf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ'
);

const visited = new Set();
const BASE = 'https://en.wiktionary.org';
const START_URL = `${BASE}/wiki/Category:English_lemmas`;
const delay = ms => new Promise(r => setTimeout(r, ms));

// Count tokens (approx 1 token ≈ 4 chars)
const countTokens = (text) => Math.ceil(text.length / 4);

// Extract training data
function extractTrainingData(html) {
  const $ = cheerio.load(html);
  const title = $('title').text().trim();
  let content = '';
  $('p, li').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 0) content += text + '\n';
  });
  return { title, content: content.trim() };
}

// Upload to Supabase
async function uploadEntry(url, title, content) {
  const tokens = countTokens(content);
  if (tokens === 0) return;

  const { data: exists } = await supabase
    .from('fai_training')
    .select('id')
    .eq('url', url)
    .limit(1);

  if (!exists || exists.length === 0) {
    await supabase.from('fai_training').insert([{
      id: nanoid(),
      url,
      title,
      content,
      tokens,
      timestamp: new Date().toISOString()
    }]);
    console.log(`🧠 Uploaded: ${title} | ${tokens} tokens`);
  }

  await supabase.from('fai_visited').insert([{ url }]);
  visited.add(url);
}

// Crawl single URL
async function crawl(url) {
  const cleanUrl = url.split('#')[0];
  if (visited.has(cleanUrl)) {
    console.log(`⚠️ Already visited or skipped: ${cleanUrl}`);
    return;
  }

  try {
    console.log(`🔍 Crawling: ${cleanUrl}`);
    const res = await axios.get(cleanUrl);
    const { title, content } = extractTrainingData(res.data);
    await uploadEntry(cleanUrl, title, content);

    const $ = cheerio.load(res.data);
    const links = $('a[href]')
      .map((_, el) => $(el).attr('href'))
      .get()
      .map(href => {
        try {
          return new URL(href, cleanUrl).href;
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .filter(href =>
        href.startsWith(`${BASE}/wiki/`) &&
        !href.includes(':') // Skip meta-pages
      );

    for (const link of links) {
      await delay(1500);
      await crawl(link);
    }
  } catch (err) {
    console.warn(`❌ Failed to crawl ${cleanUrl}: ${err.message}`);
  }
}

// Start
(async () => {
  console.log('🕷️ crawlerA booting...');
  const { data } = await supabase.from('fai_visited').select('url').limit(100000);
  data?.forEach(d => visited.add(d.url.split('#')[0]));
  console.log(`📚 Loaded ${visited.size} visited URLs`);

  await crawl(START_URL);

  const PORT = process.env.PORT || 10000;
  http.createServer((_, res) => {
    res.writeHead(200);
    res.end('crawlerA running.\n');
  }).listen(PORT, () => {
    console.log(`🔓 Port opened on ${PORT}`);
  });
})();
