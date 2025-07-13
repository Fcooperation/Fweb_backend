import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pwsxezhugsxosbwhkdvf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ' // 🔁 Replace with actual key
);

// ✅ Track visited
async function isVisited(url) {
  const { data } = await supabase.from('fai_visited').select('url').eq('url', url).maybeSingle();
  return !!data;
}
async function markVisited(url) {
  await supabase.from('fai_visited').upsert({ url });
}

// ✅ Save checkpoint
async function saveCheckpoint(index) {
  await supabase.from('fai_checkpoint').upsert({ id: 1, index });
}
async function getCheckpoint() {
  const { data } = await supabase.from('fai_checkpoint').select('index').eq('id', 1).maybeSingle();
  return data?.index || 0;
}

// ✅ Supabase upload
async function wordExists(word) {
  const { data } = await supabase.from('ftraining').select('word').eq('word', word).maybeSingle();
  return !!data;
}
async function uploadEntry(entry) {
  const { error } = await supabase.from('ftraining').insert(entry);
  if (error) console.error('❌ Upload error:', error.message);
  else console.log(`✅ Uploaded: ${entry.word}`);
}

// ✅ Check if English
function isASCII(str) {
  return /^[\x00-\x7F]+$/.test(str);
}
function hasEnglishSection($) {
  return $('h2 span#English').length > 0;
}

// ✅ Extract word entry
async function crawlWordPage(url) {
  if (await isVisited(url)) return;

  try {
    console.log(`🔍 Crawling: ${url}`);
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
    sectionContent.find('ul li').each((_, el) => {
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

// ✅ Load word links from directory
async function getAllWordLinks() {
  const baseURL = 'https://en.wiktionary.org/wiki/Special:AllPages?from=&to=&namespace=0';
  console.log(`🔎 Crawling directory: ${baseURL}`);
  const res = await fetch(baseURL);
  const html = await res.text();
  const $ = cheerio.load(html);

  const links = [];
  $('#mw-content-text a').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.startsWith('/wiki/')) {
      links.push(new URL(href, 'https://en.wiktionary.org').href);
    }
  });

  console.log(`🔗 Found ${links.length} word links`);
  return links;
}

// ✅ Start crawling with checkpoint
(async () => {
  const links = await getAllWordLinks();
  let checkpoint = await getCheckpoint();

  for (let i = checkpoint; i < links.length; i++) {
    const link = links[i];
    await crawlWordPage(link);
    await saveCheckpoint(i + 1);
  }

  console.log('✅ Finished crawling all pages.');
})();
