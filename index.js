import axios from 'axios';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import { URL } from 'url';
import http from 'http';

// ✅ Supabase setup
const supabase = createClient(
  'https://pwsxezhugsxosbwhkdvf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ'
);

// 🌐 Start URL
const START_URL = "https://en.wiktionary.org/wiki/Category:English_lemmas";

// 🧠 Memory of visited URLs
const visited = new Set();

// 🧮 Token estimator
function countTokens(text) {
  return Math.ceil(text.length / 4);
}

// 📦 Extract training-worthy content
function extractTrainingData(html) {
  const $ = cheerio.load(html);
  const title = $('title').text().trim();
  let paragraphs = [];

  $('p').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 30) {
      paragraphs.push(text);
    }
  });

  return {
    title,
    content: paragraphs.join('\n\n').trim(),
  };
}

// 🧹 Filter out non-entry pages
function isUnwantedPage(url) {
  return /\/wiki\/(Help:|File:|Talk:|Special:|Wiktionary:|Appendix_talk:|Category:|Template:|User:|MediaWiki:|Portal:|Main_Page|Privacy_policy|Contact)/.test(url);
}

// 📤 Upload to Supabase
async function uploadTrainingExample(entry) {
  const { data: exists } = await supabase
    .from('fai_training')
    .select('id')
    .eq('url', entry.url)
    .maybeSingle();

  if (!exists) {
    await supabase.from('fai_training').insert([entry]);
    console.log(`🧠 Uploaded: ${entry.title} | ${entry.tokens} tokens`);
  } else {
    console.log(`⚠️ Already uploaded: ${entry.url}`);
  }
}

// ✅ Save to visited table
async function markVisited(url) {
  const clean = url.split('#')[0];
  await supabase.from('fai_visited').insert([{ url: clean, timestamp: new Date().toISOString() }]);
  visited.add(clean);
  console.log(`✅ Marked as visited: ${clean}`);
}

// 🔁 Crawl single page
async function crawl(url) {
  const clean = url.split('#')[0];
  if (visited.has(clean) || isUnwantedPage(clean)) {
    console.log(`⚠️ Already visited or skipped: ${clean}`);
    return;
  }

  try {
    const res = await axios.get(clean);
    const { title, content } = extractTrainingData(res.data);
    const tokens = countTokens(content);
    if (tokens < 10) {
      return;
    }

    await uploadTrainingExample({
      id: nanoid(),
      url: clean,
      title,
      content,
      tokens,
      timestamp: new Date().toISOString()
    });

    await markVisited(clean);

    const $ = cheerio.load(res.data);
    const links = $('a[href]')
      .map((_, el) => $(el).attr('href'))
      .get()
      .map(href => {
        try {
          const full = new URL(href, clean).href;
          return full.split('#')[0];
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .filter(href => href.startsWith('https://en.wiktionary.org/wiki/'))
      .filter(href => !isUnwantedPage(href));

    for (const link of links) {
      await new Promise(res => setTimeout(res, 1200));
      await crawl(link);
    }

  } catch (err) {
    console.warn(`❌ Error crawling ${clean}: ${err.message}`);
  }
}

// 🚀 Start script
(async () => {
  console.log("🕷️ crawlerA booting...");

  const { data: visitedRows } = await supabase
    .from('fai_visited')
    .select('url')
    .limit(100000);

  visitedRows?.forEach(row => visited.add(row.url.split('#')[0]));

  console.log(`📚 Loaded ${visited.size} visited URLs`);

  await crawl(START_URL);

  // 🔓 Open HTTP port
  const PORT = process.env.PORT || 10000;
  http.createServer((_, res) => {
    res.writeHead(200);
    res.end("crawlerA is running.\n");
  }).listen(PORT, () => {
    console.log(`🔓 Port opened on ${PORT}`);
  });
})();
