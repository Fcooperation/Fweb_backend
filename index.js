import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';

// ✅ Supabase setup
const supabase = createClient(
  'https://pwsxezhugsxosbwhkdvf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ' // Replace with actual service role key
);

// ✅ Get last checkpoint (pagination URL)
async function getCheckpoint() {
  const { data } = await supabase
    .from('fai_checkpoint')
    .select('url')
    .eq('id', 1)
    .single();
  return data?.url || 'https://en.wiktionary.org/wiki/Special:AllPages?from=&to=&namespace=0';
}

// ✅ Save checkpoint
async function saveCheckpoint(url) {
  await supabase
    .from('fai_checkpoint')
    .upsert({ id: 1, url });
}

// ✅ Check visited
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

// ✅ Check if word already in DB
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
  const { error } = await supabase
    .from('ftraining')
    .insert(entry);
  if (error) console.error('❌ Upload error:', error.message);
  else console.log(`✅ Uploaded: ${entry.word}`);
}

// ✅ Extract + upload word page
async function processWordPage(url) {
  const visited = await isVisited(url);
  if (visited) return;

  try {
    await markVisited(url);

    const res = await fetch(url);
    if (!res.ok) return;

    const html = await res.text();
    const $ = cheerio.load(html);

    const word = $('h1').first().text().trim();
    const title = $('title').text();
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
        language: 'English',
        type,
        pronunciation,
        definitions,
        examples,
        anagrams,
        url,
        is_abbreviation,
        is_phrase,
        language_section: 'English'
      });
    }

    // Crawl more links from this page
    const links = new Set();
    $('a[href^="/wiki/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href.includes(':') && !href.includes('#')) {
        const link = new URL(href, 'https://en.wiktionary.org').href;
        links.add(link);
      }
    });

    for (const link of links) {
      await processWordPage(link);
    }

  } catch (err) {
    console.error('⚠️ Error processing:', url, err.message);
  }
}

// ✅ Crawl words from Special:AllPages directory
async function crawlAllPages(startUrl) {
  let nextPage = startUrl;

  while (nextPage) {
    console.log(`📘 Crawling directory: ${nextPage}`);
    await saveCheckpoint(nextPage);

    const res = await fetch(nextPage);
    const html = await res.text();
    const $ = cheerio.load(html);

    // Crawl word links
    const wordLinks = [];
    $('#mw-content-text a[href^="/wiki/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href.includes(':') && !href.includes('#')) {
        const full = new URL(href, 'https://en.wiktionary.org').href;
        wordLinks.push(full);
      }
    });

    console.log(`🔗 Found ${wordLinks.length} word links`);

    for (const link of wordLinks) {
      await processWordPage(link);
    }

    // Find next page
    const next = $('a:contains("next page")').attr('href');
    if (next) {
      nextPage = new URL(next, 'https://en.wiktionary.org').href;
    } else {
      console.log('✅ Reached end of all pages.');
      break;
    }
  }
}

// ✅ START
const checkpoint = await getCheckpoint();
await crawlAllPages(checkpoint);

// Optional: prevent Render from exiting early
setTimeout(() => console.log('🕓 Done'), 1000);
