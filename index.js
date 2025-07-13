import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';

// ✅ Supabase setup
const supabase = createClient(
  'https://pwsxezhugsxosbwhkdvf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ' // Replace with actual key
);

// ✅ Track visited pages
async function isVisited(url) {
  const { data } = await supabase.from('fai_visited').select('url').eq('url', url).maybeSingle();
  return !!data;
}
async function markVisited(url) {
  await supabase.from('fai_visited').upsert({ url });
}

// ✅ Prevent duplicate word uploads
async function wordExists(word) {
  const { data } = await supabase.from('ftraining').select('word').eq('word', word).maybeSingle();
  return !!data;
}

// ✅ Upload dictionary entry
async function uploadEntry(entry) {
  const { error } = await supabase.from('ftraining').insert(entry);
  if (error) console.error('❌ Upload error:', error.message);
  else console.log(`✅ Uploaded: ${entry.word} (${entry.definitions.length} defs)`);
}

// ✅ Crawl actual word page
async function crawlWordPage(url) {
  const visited = await isVisited(url);
  if (visited) return;

  console.log(`🔍 Crawling word: ${url}`);
  await markVisited(url);

  try {
    const res = await fetch(url);
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

    if (!await wordExists(word)) {
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

  } catch (err) {
    console.error('⚠️ Error:', err.message);
  }
}

// ✅ Crawl index page like Index:A
async function crawlIndexPage(letter) {
  const indexUrl = `https://en.wiktionary.org/wiki/Index:${letter}`;
  console.log(`🔤 Crawling Index:${letter}`);

  try {
    const res = await fetch(indexUrl);
    const html = await res.text();
    const $ = cheerio.load(html);

    const wordLinks = [];
    $('a[href^="/wiki/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (
        href &&
        !href.includes(':') && // skip meta
        !href.includes('#')
      ) {
        const link = new URL(href, 'https://en.wiktionary.org').href;
        wordLinks.push(link);
      }
    });

    const uniqueLinks = Array.from(new Set(wordLinks));
    console.log(`🔗 Found ${uniqueLinks.length} word links in Index:${letter}`);

    for (const link of uniqueLinks) {
      await crawlWordPage(link);
    }

  } catch (err) {
    console.error(`❌ Failed to crawl Index:${letter}:`, err.message);
  }
}

// ✅ Full A–Z crawl
async function crawlAllIndexes() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  for (const letter of letters) {
    await crawlIndexPage(letter);
  }
  console.log('✅ Finished A–Z crawl.');
}

// ✅ Run it
await crawlAllIndexes();
setTimeout(() => console.log('🕓 Done'), 1000);
