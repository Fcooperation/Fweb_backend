import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';

// ✅ Supabase setup
const supabase = createClient(
  'https://pwsxezhugsxosbwhkdvf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ' // replace this with your service role key
);

// ✅ Save checkpoint
async function saveCheckpoint(letter) {
  await supabase.from('fai_checkpoint').upsert({ id: 1, url: letter });
}

// ✅ Get checkpoint
async function getCheckpoint() {
  const { data } = await supabase.from('fai_checkpoint').select('url').eq('id', 1).single();
  return data?.url || 'A';
}

// ✅ Check visited
async function isVisited(url) {
  const { data } = await supabase.from('fai_visited').select('url').eq('url', url).maybeSingle();
  return !!data;
}

// ✅ Mark as visited
async function markVisited(url) {
  await supabase.from('fai_visited').upsert({ url });
}

// ✅ Check if word exists
async function wordExists(word) {
  const { data } = await supabase.from('ftraining').select('word').eq('word', word).maybeSingle();
  return !!data;
}

// ✅ Upload dictionary entry
async function uploadEntry(entry) {
  const { error } = await supabase.from('ftraining').insert(entry);
  if (error) console.error('❌ Upload error:', error.message);
  else console.log(`✅ Uploaded: ${entry.word} | ${entry.definitions.length} defs`);
}

// ✅ Main crawl for one word URL
async function crawlWord(url, depth = 1) {
  const visited = await isVisited(url);
  if (!visited) await markVisited(url);
  else {
    console.log(`⚠️ Already visited: ${url}`);
    return;
  }

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

    if (!(await wordExists(word))) {
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

    // ✅ Crawl further links (internal dictionary links)
    if (depth > 0) {
      const nextLinks = new Set();
      $('a[href^="/wiki/"]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href.includes(':') && !href.includes('#')) {
          const link = new URL(href, 'https://en.wiktionary.org').href;
          nextLinks.add(link);
        }
      });

      for (const link of nextLinks) {
        if (!(await isVisited(link))) {
          await crawlWord(link, depth - 1);
        }
      }
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

// ✅ Crawl index letter page
async function crawlIndex(letter) {
  const url = `https://en.wiktionary.org/wiki/Index:${letter}`;
  console.log(`🔤 Crawling Index:${letter}`);

  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const html = await res.text();
    const $ = cheerio.load(html);

    const links = [];
    $('#mw-content-text a').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.startsWith('/wiki/') && !href.includes(':')) {
        links.push(new URL(href, 'https://en.wiktionary.org').href);
      }
    });

    console.log(`🔗 Found ${links.length} word links`);
    for (const link of links) {
      await crawlWord(link, 1);
    }

    await saveCheckpoint(letter);
  } catch (err) {
    console.error('❌ Index crawl failed:', err.message);
  }
}

// ✅ Start from checkpoint
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const checkpoint = await getCheckpoint();
const startIndex = alphabet.indexOf(checkpoint);

for (const letter of alphabet.slice(startIndex)) {
  await crawlIndex(letter);
}

console.log('✅ Finished A–Z crawl.');
setTimeout(() => console.log('🕓 Done'), 1000);
