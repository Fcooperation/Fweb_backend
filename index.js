import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';

// ✅ Supabase setup
const supabase = createClient(
  'https://pwsxezhugsxosbwhkdvf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ'
);

// ✅ Start from real dictionary root
const START_URL = 'https://en.wiktionary.org/wiki/Category:English_lemmas';

// ✅ Visited cache to reduce Supabase load
const visitedCache = new Set();

// ✅ Load checkpoint
async function getCheckpoint() {
  const { data } = await supabase
    .from('fai_checkpoint')
    .select('url')
    .eq('id', 1)
    .single();
  return data?.url || START_URL;
}

// ✅ Save checkpoint
async function saveCheckpoint(url) {
  await supabase
    .from('fai_checkpoint')
    .upsert({ id: 1, url });
}

// ✅ Check if visited
async function isVisited(url) {
  if (visitedCache.has(url)) return true;
  const { data } = await supabase
    .from('fai_visited')
    .select('url')
    .eq('url', url)
    .maybeSingle();
  const result = !!data;
  if (result) visitedCache.add(url);
  return result;
}

// ✅ Mark visited
async function markVisited(url) {
  visitedCache.add(url);
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
  if (error) console.error('❌ Upload error:', error.message);
  else console.log(`✅ Uploaded: ${entry.word} | ${entry.definitions.length} defs`);
}

// ✅ Main crawler logic
async function crawl(url) {
  if (await isVisited(url)) {
    console.log(`⚠️ Already visited: ${url}`);
    return;
  }

  await markVisited(url);
  await saveCheckpoint(url);
  console.log(`🔗 Crawling: ${url}`);

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

    if (definitions.length && !await wordExists(word)) {
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
    }

    // ✅ Find all valid next links
    const nextLinks = new Set();
    $('a[href^="/wiki/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (
        !href.includes('#') &&
        !href.includes('Help:') &&
        !href.includes('Talk:') &&
        !href.includes('Wiktionary:') &&
        !href.includes('File:') &&
        !href.includes('Special:') &&
        !href.includes('Category:') // comment this line if you want to allow crawling deeper categories
      ) {
        const link = new URL(href, 'https://en.wiktionary.org').href;
        nextLinks.add(link);
      }
    });

    for (const link of nextLinks) {
      await crawl(link); // no depth limit
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

// ✅ Begin crawling
const start = await getCheckpoint();
console.log(`🚀 Resuming crawl from: ${start}`);
await crawl(start);

// 🔁 Keep process alive briefly (for platforms like Render)
setTimeout(() => console.log('⏳ Done crawling.'), 2000);
