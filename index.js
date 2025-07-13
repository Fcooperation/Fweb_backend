import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';

// ✅ Supabase setup
const supabase = createClient(
  'https://pwsxezhugsxosbwhkdvf.supabase.co',
  'YOUR_SERVICE_ROLE_KEY_HERE' // Replace with actual service role key
);

// ✅ Utilities
function isASCII(str) {
  return /^[\x00-\x7F]+$/.test(str);
}

// ✅ Delete everything except English
function hasEnglishSection($) {
  return $('h2 span#English').length > 0;
}

// ✅ Get links from directory page
async function getAllWordLinks() {
  const url = 'https://en.wiktionary.org/wiki/Special:AllPages?from=&to=&namespace=0';
  console.log(`🔎 Crawling directory: ${url}`);
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);

  const links = [];
  $('#mw-content-text a').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.startsWith('/wiki/')) {
      const wordUrl = new URL(href, 'https://en.wiktionary.org').href;
      links.push(wordUrl);
    }
  });

  console.log(`🔗 Found ${links.length} word links`);
  return links;
}

// ✅ Check visited
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
  else console.log(`✅ Uploaded: ${entry.word}`);
}

// ✅ Crawl individual word
async function crawlWordPage(url) {
  if (await isVisited(url)) return;

  try {
    console.log(`🔍 Crawling word: ${url}`);
    const res = await fetch(url);
    if (!res.ok) return;

    const html = await res.text();
    const $ = cheerio.load(html);

    if (!hasEnglishSection($)) return;

    const word = $('h1').first().text().trim();
    if (!word || !isASCII(word)) return;

    const englishSection = $('span#English').closest('h2');
    const sectionIndex = $('h2').index(englishSection);
    const sectionContent = $('h2').eq(sectionIndex).nextUntil('h2');

    const pronunciation = sectionContent.find('.IPA').first().text().trim();
    const type = sectionContent.find('.headword-line').first().text().trim();

    const definitions = [];
    sectionContent.find('ol > li').each((_, el) => {
      const def = $(el).clone().find('ul, dl').remove().end().text().trim();
      if (def) definitions.push(def);
    });

    const examples = [];
    sectionContent.find('ul li:contains("Usage notes")').each((_, el) => {
      const example = $(el).text().trim();
      if (example) examples.push(example);
    });

    const anagrams = [];
    sectionContent.find('dd:contains("Anagrams")').next('ul').find('li').each((_, el) => {
      const ana = $(el).text().trim();
      if (ana) anagrams.push(ana);
    });

    const title = $('title').text();
    const is_abbreviation = title.toLowerCase().includes('abbreviation');
    const is_phrase = word.includes(' ') || word.includes('-');

    if (!(await wordExists(word))) {
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

    await markVisited(url);
  } catch (err) {
    console.error('⚠️ Error:', err.message);
  }
}

// ✅ Start Crawl
(async () => {
  const links = await getAllWordLinks();

  for (const link of links) {
    await crawlWordPage(link);
  }

  console.log('✅ Finished crawling all pages.');
})();
