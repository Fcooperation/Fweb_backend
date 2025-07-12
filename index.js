import axios from 'axios';
import cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import { URL } from 'url';
import http from 'http';

// === 🔐 Supabase Credentials ===
const supabase = createClient(
  'https://pwsxezhugsxosbwhkdvf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ'
);

// === 🌐 CRAWLER CONFIG ===
const BASE = 'https://en.wiktionary.org';
const START_URL = `${BASE}/wiki/Category:English_lemmas`;
const visited = new Set();

function countTokens(text) {
  return Math.ceil(text.length / 4);
}

function extractTrainingData(html) {
  const $ = cheerio.load(html);
  const title = $('title').text().trim();
  let content = '';

  $('#mw-content-text p').each((_, el) => {
    const txt = $(el).text().trim();
    if (txt.length > 0) content += txt + '\n';
  });

  return { title, content: content.trim() };
}

async function uploadTrainingData(entry) {
  if (!entry.url || !entry.content || entry.tokens === 0) return;

  const { data: existing } = await supabase
    .from('fai_training')
    .select('id')
    .eq('url', entry.url)
    .limit(1);

  if (!existing || existing.length === 0) {
    await supabase.from('fai_training').insert([entry]);
    console.log(`🧠 Uploaded: ${entry.title} | ${entry.tokens} tokens`);
  } else {
    console.log(`⚠️ Already uploaded: ${entry.url}`);
  }
}

async function markVisited(url) {
  await supabase.from('fai_visited').insert([{ url, timestamp: new Date().toISOString() }]);
  visited.add(url);
  console.log(`✅ Marked as visited: ${url}`);
}

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
    const tokens = countTokens(content);

    if (tokens > 0) {
      await uploadTrainingData({
        id: nanoid(),
        url: cleanUrl,
        title,
        content,
        tokens,
        timestamp: new Date().toISOString(),
      });
    }

    await markVisited(cleanUrl);

    const $ = cheerio.load(res.data);

    // 🌱 Crawl valid word entry links
    const wordLinks = $('a[href]')
      .map((_, el) => $(el).attr('href'))
      .get()
      .map(href => {
        try {
          return new URL(href, BASE).href;
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .filter(href => href.startsWith(`${BASE}/wiki/`) && !href.includes(':'));

    // 🔁 Pagination (e.g., ?pagefrom=...)
    const nextPages = $('a[href*="pagefrom="]')
      .map((_, el) => $(el).attr('href'))
      .get()
      .map(href => new URL(href, BASE).href);

    const uniqueLinks = [...new Set([...wordLinks, ...nextPages])];

    for (const link of uniqueLinks) {
      await new Promise(r => setTimeout(r, 1500));
      await crawl(link);
    }

  } catch (err) {
    console.warn(`❌ Failed to crawl ${cleanUrl}: ${err.message}`);
  }
}

(async () => {
  console.log('🕷️ crawlerA booting...');

  const { data } = await supabase.from('fai_visited').select('url').limit(100000);
  if (data) data.forEach(d => visited.add(d.url.split('#')[0]));
  console.log(`📚 Loaded ${visited.size} visited URLs`);

  await crawl(START_URL);

  // 🌐 Port for Render
  const PORT = process.env.PORT || 10000;
  http.createServer((_, res) => {
    res.writeHead(200);
    res.end('crawlerA is running.\n');
  }).listen(PORT, () => {
    console.log(`🔓 Port opened on ${PORT}`);
  });
})();
