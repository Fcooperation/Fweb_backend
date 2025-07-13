import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';

// ✅ Supabase setup
const supabase = createClient(
  'https://pwsxezhugsxosbwhkdvf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ'
);

// ✅ Helpers
async function isVisited(url) {
  const { data } = await supabase.from('fai_visited').select('url').eq('url', url).maybeSingle();
  return !!data;
}

async function markVisited(url) {
  await supabase.from('fai_visited').upsert({ url });
}

async function wordExists(word) {
  const { data } = await supabase.from('ftraining').select('word').eq('word', word).maybeSingle();
  return !!data;
}

async function uploadEntry(entry) {
  const { error } = await supabase.from('ftraining').insert(entry);
  if (error) console.error('❌ Upload error:', error.message);
  else console.log(`✅ Uploaded: ${entry.word} | ${entry.definitions.length} defs`);
}

// ✅ Crawl actual dictionary word page
async function crawlWord(url) {
  if (await isVisited(url)) return;
  await markVisited(url);

  try {
    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);

    const word = $('h1').first().text().trim();
    const title = $('title').text().toLowerCase();
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

    const is_abbreviation = title.includes('abbreviation');
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

    // 🔁 Continue crawling from this word’s page (external/internal links)
    const nextLinks = new Set();
    $('a[href^="/wiki/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href.includes(':') && !href.includes('#')) {
        const link = new URL(href, 'https://en.wiktionary.org').href;
        nextLinks.add(link);
      }
    });

    for (const link of nextLinks) {
      await crawlWord(link);
    }

  } catch (err) {
    console.error(`⚠️ Error crawling word page ${url}:`, err.message);
  }
}

// ✅ Crawl sub-index (like Index:A-a)
async function crawlSubIndex(url) {
  try {
    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);

    const wordLinks = new Set();

    $('a[href^="/wiki/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href.includes('Index:') && !href.includes(':') && !href.includes('#')) {
        const full = new URL(href, 'https://en.wiktionary.org').href;
        wordLinks.add(full);
      }
    });

    console.log(`🔗 Found ${wordLinks.size} word links in ${url}`);

    for (const link of wordLinks) {
      await crawlWord(link);
    }

  } catch (err) {
    console.error(`❌ Error crawling sub-index ${url}:`, err.message);
  }
}

// ✅ Crawl all A–Z
async function crawlAllAZ() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  for (const letter of letters) {
    const indexUrl = `https://en.wiktionary.org/wiki/Index:${letter}`;
    console.log(`🔤 Crawling Index:${letter}`);

    try {
      const res = await fetch(indexUrl);
      const html = await res.text();
      const $ = cheerio.load(html);

      const subIndexes = new Set();

      $('a[href^="/wiki/Index:"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href.includes(`Index:${letter}`)) {
          const full = new URL(href, 'https://en.wiktionary.org').href;
          subIndexes.add(full);
        }
      });

      if (subIndexes.size === 0) {
        console.log(`🔗 Found no sub-index in Index:${letter}`);
      }

      for (const subIndexUrl of subIndexes) {
        await crawlSubIndex(subIndexUrl);
      }

    } catch (err) {
      console.error(`❌ Failed to crawl Index:${letter}`, err.message);
    }
  }

  console.log('✅ Finished A–Z crawl.');
}

// ✅ Start crawling
await crawlAllAZ();

// 🕓 Keep alive
setTimeout(() => console.log('🕓 Done'), 2000);
