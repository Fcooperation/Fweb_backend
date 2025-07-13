import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';

// ✅ Supabase config
const supabase = createClient(
  'https://pwsxezhugsxosbwhkdvf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ'
);

// ✅ Get checkpoint (last completed letter)
async function getCheckpoint() {
  const { data } = await supabase
    .from('fai_checkpoint')
    .select('url')
    .eq('id', 1)
    .maybeSingle();
  return data?.url || 'A';
}

// ✅ Save checkpoint
async function saveCheckpoint(letter) {
  await supabase.from('fai_checkpoint').upsert({ id: 1, url: letter });
}

// ✅ Visited checker
async function isVisited(url) {
  const { data } = await supabase
    .from('fai_visited')
    .select('url')
    .eq('url', url)
    .maybeSingle();
  return !!data;
}

async function markVisited(url) {
  await supabase.from('fai_visited').upsert({ url });
}

// ✅ Check if word exists
async function wordExists(word) {
  const { data } = await supabase
    .from('ftraining')
    .select('word')
    .eq('word', word)
    .maybeSingle();
  return !!data;
}

// ✅ Upload word entry
async function uploadEntry(entry) {
  const { error } = await supabase.from('ftraining').insert(entry);
  if (error) console.error('❌ Upload error:', error.message);
  else console.log(`✅ Uploaded: ${entry.word} | ${entry.definitions.length} defs`);
}

// ✅ Crawl actual word page
async function crawlWord(url) {
  if (await isVisited(url)) return;

  await markVisited(url);

  try {
    console.log(`📘 Crawling word: ${url}`);
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
    } else {
      console.log(`⚠️ Already uploaded: ${word}`);
    }

    // ✅ Find and crawl external/internal links (no meta)
    const nextLinks = new Set();
    $('a[href^="/wiki/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && !href.includes(':') && !href.includes('#')) {
        const full = new URL(href, 'https://en.wiktionary.org').href;
        nextLinks.add(full);
      }
    });

    for (const link of nextLinks) {
      if (!(await isVisited(link))) {
        await crawlWord(link);
        await new Promise((r) => setTimeout(r, 1000)); // delay
      }
    }

  } catch (err) {
    console.error('⚠️ Error:', err.message);
  }
}

// ✅ Crawl A–Z index pages
async function crawlAZ() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const start = await getCheckpoint();
  const startIndex = letters.indexOf(start);

  for (let i = startIndex; i < letters.length; i++) {
    const letter = letters[i];
    console.log(`🔤 Crawling Index:${letter}`);
    const url = `https://en.wiktionary.org/wiki/Index:${letter}`;

    try {
      const res = await fetch(url);
      const html = await res.text();
      const $ = cheerio.load(html);

      const links = new Set();
      $('div.mw-allpages-body a').each((_, el) => {
        const href = $(el).attr('href');
        if (href && !href.includes(':') && !href.includes('#')) {
          const full = new URL(href, 'https://en.wiktionary.org').href;
          links.add(full);
        }
      });

      console.log(`🔗 Found ${links.size} word links`);
      for (const link of links) {
        await crawlWord(link);
        await new Promise((r) => setTimeout(r, 1000)); // delay
      }

      await saveCheckpoint(letter); // save letter checkpoint

    } catch (err) {
      console.error(`❌ Failed Index:${letter}`, err.message);
    }
  }

  console.log('✅ Finished A–Z crawl.');
}

await crawlAZ();

// Prevent Render from exiting early
setTimeout(() => console.log('🕓 Done'), 5000);
