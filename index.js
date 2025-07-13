import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';

// ✅ Supabase setup
const supabase = createClient(
  'https://pwsxezhugsxosbwhkdvf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ' // Replace this with your real service role key (keep private!)
);

// ✅ Load checkpoint
async function getCheckpoint() {
  const { data, error } = await supabase
    .from('fai_checkpoint')
    .select('url')
    .eq('id', 1)
    .single();

  return data?.url || 'https://en.wiktionary.org/wiki/apple';
}

// ✅ Save checkpoint
async function saveCheckpoint(url) {
  await supabase.from('fai_checkpoint').upsert({ id: 1, url });
}

// ✅ Check if visited
async function isVisited(url) {
  const { data } = await supabase
    .from('fai_visited')
    .select('url')
    .eq('url', url)
    .single();

  return !!data;
}

// ✅ Mark as visited
async function markVisited(url) {
  await supabase.from('fai_visited').upsert({ url });
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

// ✅ Upload entry
async function uploadEntry(entry) {
  const { error } = await supabase.from('ftraining').insert(entry);
  if (error) {
    console.error('❌ Upload error:', error.message);
  } else {
    console.log(`✅ Uploaded: ${entry.word} | ${entry.definitions.length} defs`);
  }
}

// ✅ Crawler
async function crawl(url, depth = 1) {
  if (await isVisited(url) || depth < 0) {
    console.log(`⚠️ Already visited or too shallow: ${url}`);
    return;
  }

  await markVisited(url);
  await saveCheckpoint(url);

  try {
    console.log(`🔗 Crawling word: ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`❌ Failed to fetch: ${url}`);
      return;
    }

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
      console.log(`⏭️ Skipped existing word: ${word}`);
    }

    // ✅ Crawl next links
    const nextLinks = new Set();
    $('a[href^="/wiki/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href.includes(':') && !href.includes('#')) {
        const link = new URL(href, 'https://en.wiktionary.org').href;
        nextLinks.add(link);
      }
    });

    const uniqueLinks = Array.from(nextLinks).slice(0, 5);
    for (const link of uniqueLinks) {
      await crawl(link, depth - 1);
    }

  } catch (err) {
    console.error('⚠️ Error crawling:', err.message);
  }
}

// ✅ Start crawling from last checkpoint
(async () => {
  try {
    const start = await getCheckpoint();
    console.log(`🚀 Resuming crawl from: ${start}`);
    await crawl(start, 2);
  } catch (err) {
    console.error('❌ Uncaught fatal error:', err.message);
  }
})();
