import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';

// ✅ Supabase setup
const supabase = createClient(
  'https://pwsxezhugsxosbwhkdvf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ'
);

// ✅ ASCII check
const isASCII = (str) => /^[\x00-\x7F]+$/.test(str);

// ✅ Load last checkpoint (word position)
async function getCheckpoint() {
  const { data } = await supabase
    .from('fai_checkpoint')
    .select('url')
    .eq('id', 1)
    .single();
  return data?.url || 'https://en.wiktionary.org/wiki/Special:AllPages?from=&to=&namespace=0';
}

async function saveCheckpoint(url) {
  await supabase.from('fai_checkpoint').upsert({ id: 1, url });
}

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

async function wordExists(word) {
  const { data } = await supabase
    .from('ftraining')
    .select('word')
    .eq('word', word)
    .maybeSingle();
  return !!data;
}

async function uploadEntry(entry) {
  const { error } = await supabase.from('ftraining').insert(entry);
  if (error) console.error('❌ Upload error:', error.message);
  else console.log(`✅ Uploaded: ${entry.word}`);
}

// ✅ Crawl a single word page
async function crawlWordPage(url) {
  const visited = await isVisited(url);
  if (visited) return;

  await markVisited(url);
  await saveCheckpoint(url);
  console.log(`🔍 Crawling word: ${url}`);

  try {
    const res = await fetch(url);
    if (!res.ok) return;

    const html = await res.text();
    const $ = cheerio.load(html);

    const word = $('h1').first().text().trim();
    if (!isASCII(word)) return;

    const englishHeader = $('h2:has(span#English)');
    if (englishHeader.length === 0) return;

    const section = englishHeader.nextUntil('h2');
    const definitions = [];
    const pronunciation = section.find('span.IPA').first().text().trim();
    const type = section.find('span.headword-line').first().text().trim();
    const examples = [];
    const anagrams = [];

    section.find('ol > li').each((_, el) => {
      const def = $(el).clone().find('ul, dl').remove().end().text().trim();
      if (def) definitions.push(def);
    });

    section.find('li:contains("Usage notes") ~ ul li').each((_, el) => {
      const example = $(el).text().trim();
      if (example) examples.push(example);
    });

    section.find('dd:contains("Anagrams")').next('ul').find('li').each((_, el) => {
      const ana = $(el).text().trim();
      if (ana) anagrams.push(ana);
    });

    const title = $('title').text();
    const is_abbreviation = title.toLowerCase().includes('abbreviation');
    const is_phrase = word.includes(' ') || word.includes('-');

    if (definitions.length && !await wordExists(word)) {
      await uploadEntry({
        word,
        language: 'English',
        type,
        definitions,
        pronunciation,
        examples,
        anagrams,
        url,
        is_abbreviation,
        is_phrase,
        language_section: 'English'
      });
    }

  } catch (err) {
    console.error(`❌ Error crawling ${url}:`, err.message);
  }
}

// ✅ Crawl a single AllPages page
async function crawlDirectoryPage(startFrom = '') {
  const url = `https://en.wiktionary.org/wiki/Special:AllPages?from=${startFrom}&to=&namespace=0`;
  console.log(`📂 Crawling directory: ${url}`);
  const res = await fetch(url);
  if (!res.ok) return;

  const html = await res.text();
  const $ = cheerio.load(html);

  const links = [];
  $('#mw-content-text a').each((_, el) => {
    const href = $(el).attr('href');
    if (href?.startsWith('/wiki/') && !href.includes(':') && !href.includes('#')) {
      const fullUrl = new URL(href, 'https://en.wiktionary.org').href;
      links.push(fullUrl);
    }
  });

  const nextLink = $('a:contains("Next page")').attr('href');
  const nextStart = nextLink ? new URLSearchParams(nextLink.split('?')[1]).get('from') : null;

  console.log(`🔗 Found ${links.length} word links`);
  for (const link of links) {
    await crawlWordPage(link);
  }

  if (nextStart) {
    await saveCheckpoint(`https://en.wiktionary.org/wiki/Special:AllPages?from=${nextStart}&to=&namespace=0`);
    await crawlDirectoryPage(nextStart);
  } else {
    console.log(`✅ Reached end of dictionary.`);
  }
}

// ✅ Start from checkpoint
const checkpointURL = await getCheckpoint();
const startFrom = new URL(checkpointURL).searchParams.get('from') || '';
await crawlDirectoryPage(startFrom);

// Prevent exit on platforms like Render
setTimeout(() => console.log('🕓 Done crawling full dictionary'), 1000);
