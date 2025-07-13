import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';

// ✅ Supabase setup
const supabase = createClient(
  'https://pwsxezhugsxosbwhkdvf.supabase.co',
  'YOUR_SUPABASE_SERVICE_ROLE_KEY'
);

// ✅ Load last checkpoint
async function getCheckpoint() {
  const { data } = await supabase
    .from('fai_checkpoint')
    .select('url')
    .eq('id', 1)
    .single();
  return data?.url || 'https://en.wiktionary.org/wiki/Wiktionary:All_pages';
}

// ✅ Save current checkpoint
async function saveCheckpoint(url) {
  await supabase
    .from('fai_checkpoint')
    .upsert({ id: 1, url });
}

// ✅ Check if already visited
async function isVisited(url) {
  const { data } = await supabase
    .from('fai_visited')
    .select('url')
    .eq('url', url)
    .maybeSingle();
  return !!data;
}

// ✅ Mark as visited
async function markVisited(url) {
  await supabase
    .from('fai_visited')
    .upsert({ url });
}

// ✅ Check if word already exists
async function wordExists(word) {
  const { data } = await supabase
    .from('ftraining')
    .select('word')
    .eq('word', word)
    .maybeSingle();
  return !!data;
}

// ✅ Upload dictionary entry
async function uploadEntry(entry) {
  const { error } = await supabase
    .from('ftraining')
    .insert(entry);
  if (error) console.error('Upload error:', error.message);
  else console.log(`✅ Uploaded: ${entry.word} | ${entry.definitions.length} defs`);
}

// ✅ Main crawl logic
async function crawl(url) {
  const alreadyVisited = await isVisited(url);
  const parsedURL = new URL(url);

  // Avoid meta pages
  if (url.includes(':') && !url.includes('http')) {
    console.log(`⛔ Skipping meta page: ${url}`);
    return;
  }

  await markVisited(url);
  await saveCheckpoint(url);
  console.log(`🔗 Crawling word: ${url}`);

  try {
    const res = await fetch(url);
    if (!res.ok) return;

    const html = await res.text();
    const $ = cheerio.load(html);

    const word = $('h1').first().text().trim();
    const title = $('title').text();
    const language = 'English';
    const pronunciation = $('span.IPA').first().text().trim();
    const type = $('span.headword-line').first().text().trim();
    const definitions = [];
    const examples = [];
    const anagrams = [];

    $('ol > li').each((_, el) => {
      const def = $(el).clone().find('ul, dl').remove().end().text().trim();
      if (def) definitions.push(def);
    });

    $('dd:contains("Anagrams")').next('ul').find('li').each((_, el) => {
      const ana = $(el).text().trim();
      if (ana) anagrams.push(ana);
    });

    $('li:contains("Usage notes") ~ ul li').each((_, el) => {
      const example = $(el).text().trim();
      if (example) examples.push(example);
    });

    const is_abbreviation = title.toLowerCase().includes('abbreviation');
    const is_phrase = word.includes(' ') || word.includes('-');

    // ✅ Only upload if not visited before and word is not yet in DB
    if (!alreadyVisited && !await wordExists(word)) {
      await uploadEntry({
        word,
        language,
        type,
        definitions,
        pronunciation,
        examples,
        anagrams,
        url,
        is_abbreviation,
        is_phrase,
        language_section: language
      });
    } else {
      console.log(`⚠️ Skipped upload: ${word}`);
    }

    // ✅ Now crawl for internal and external links
    const links = new Set();
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const fullURL = new URL(href, parsedURL.origin).href;

      // Avoid non-Wiktionary meta links (like /wiki/Category:, etc.)
      if (fullURL.includes('wiktionary.org/wiki/') && !fullURL.includes(':')) {
        links.add(fullURL);
      }
    });

    // Crawl all unique links found (no limit)
    for (const link of links) {
      const seen = await isVisited(link);
      const exists = await wordExists(link.split('/wiki/')[1]);
      // If not seen, crawl it fully
      // If seen but not in storage, still crawl it to find more links
      if (!seen || !exists) {
        await crawl(link);
      }
    }

  } catch (err) {
    console.error('⚠️ Error:', err.message);
  }
}

// ✅ Start
const start = await getCheckpoint();
console.log(`🚀 Resuming crawl from: ${start}`);
await crawl(start);

// Prevent early Render shutdown
setTimeout(() => console.log('⏳ Done.'), 1000);
