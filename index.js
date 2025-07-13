import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';

// ✅ Supabase setup
const supabase = createClient(
  'https://pwsxezhugsxosbwhkdvf.supabase.co',
  'YOUR_SUPABASE_SERVICE_ROLE_KEY'
);

// ✅ Load checkpoint
async function getCheckpoint() {
  const { data } = await supabase.from('fai_checkpoint').select('url').eq('id', 1).single();
  return data?.url || 'https://en.wiktionary.org/wiki/Special:AllPages?from=&to=&namespace=0';
}

// ✅ Save checkpoint
async function saveCheckpoint(url) {
  await supabase.from('fai_checkpoint').upsert({ id: 1, url });
}

// ✅ Check visited
async function isVisited(url) {
  const { data } = await supabase.from('fai_visited').select('url').eq('url', url).maybeSingle();
  return !!data;
}

// ✅ Mark visited
async function markVisited(url) {
  await supabase.from('fai_visited').upsert({ url });
}

// ✅ Check if word exists
async function wordExists(word) {
  const { data } = await supabase.from('ftraining').select('word').eq('word', word).maybeSingle();
  return !!data;
}

// ✅ Upload word entry
async function uploadEntry(entry) {
  const { error } = await supabase.from('ftraining').insert(entry);
  if (error) console.error('❌ Upload error:', error.message);
  else console.log(`✅ Uploaded: ${entry.word} | ${entry.definitions.length} defs`);
}

// ✅ Parse only English section
function extractEnglishContent($) {
  const englishSection = $('h2:has(span#English)').nextUntil('h2');
  if (!englishSection.length) return null;

  const pronunciation = englishSection.find('span.IPA').first().text().trim();
  const type = englishSection.find('span.headword-line').first().text().trim();
  const definitions = [];
  const examples = [];
  const anagrams = [];

  englishSection.find('ol > li').each((_, el) => {
    const def = $(el).clone().find('ul, dl').remove().end().text().trim();
    if (def) definitions.push(def);
  });

  englishSection.find('li:contains("Usage notes") ~ ul li').each((_, el) => {
    const ex = $(el).text().trim();
    if (ex) examples.push(ex);
  });

  englishSection.find('dd:contains("Anagrams")').next('ul').find('li').each((_, el) => {
    const ana = $(el).text().trim();
    if (ana) anagrams.push(ana);
  });

  return { pronunciation, type, definitions, examples, anagrams };
}

// ✅ Crawl page
async function crawlWord(url) {
  if (await isVisited(url)) return;

  await markVisited(url);
  await saveCheckpoint(url);
  console.log(`🔍 Crawling word: ${url}`);

  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const html = await res.text();
    const $ = cheerio.load(html);

    const word = $('h1').first().text().trim();
    const title = $('title').text();
    const english = extractEnglishContent($);
    if (!english || english.definitions.length === 0) return;

    if (await wordExists(word)) return;

    const is_abbreviation = title.toLowerCase().includes('abbreviation');
    const is_phrase = word.includes(' ') || word.includes('-');

    await uploadEntry({
      word,
      language: 'English',
      type: english.type,
      definitions: english.definitions,
      pronunciation: english.pronunciation,
      examples: english.examples,
      anagrams: english.anagrams,
      url,
      is_abbreviation,
      is_phrase,
      language_section: 'English'
    });
  } catch (err) {
    console.error(`⚠️ Error at ${url}:`, err.message);
  }
}

// ✅ Crawl directory
async function crawlAllPages() {
  const startUrl = 'https://en.wiktionary.org/wiki/Special:AllPages?from=&to=&namespace=0';
  console.log(`🔎 Crawling directory: ${startUrl}`);
  const res = await fetch(startUrl);
  const html = await res.text();
  const $ = cheerio.load(html);

  const links = [];
  $('#mw-content-text a').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.startsWith('/wiki/') && !href.includes(':')) {
      const full = new URL(href, 'https://en.wiktionary.org').href;
      links.push(full);
    }
  });

  console.log(`🔗 Found ${links.length} word links`);

  for (const link of links) {
    await crawlWord(link);
  }

  console.log('✅ Finished crawling all pages.');
}

// ✅ Start crawling
await crawlAllPages();
console.log('🕓 Done');
