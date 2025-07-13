import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';

// ✅ Supabase setup
const supabase = createClient(
  'https://pwsxezhugsxosbwhkdvf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ'
);

// ✅ Helper: get checkpoint letter
async function getCheckpoint() {
  const { data } = await supabase
    .from('fai_checkpoint')
    .select('letter')
    .eq('id', 1)
    .single();
  return data?.letter || 'A';
}

// ✅ Save current checkpoint
async function saveCheckpoint(letter) {
  await supabase
    .from('fai_checkpoint')
    .upsert({ id: 1, letter });
}

// ✅ Mark visited
async function markVisited(url) {
  await supabase
    .from('fai_visited')
    .upsert({ url });
}

// ✅ Check if visited
async function isVisited(url) {
  const { data } = await supabase
    .from('fai_visited')
    .select('url')
    .eq('url', url)
    .maybeSingle();
  return !!data;
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

// ✅ Upload dictionary word
async function uploadEntry(entry) {
  const { error } = await supabase
    .from('ftraining')
    .insert(entry);
  if (error) console.error('Upload error:', error.message);
  else console.log(`✅ Uploaded: ${entry.word}`);
}

// ✅ Extract and upload real entry
async function crawlWord(url) {
  if (await isVisited(url)) return;
  await markVisited(url);

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

    if (definitions.length && !(await wordExists(word))) {
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
      console.log(`⚠️ Skipped or already exists: ${word}`);
    }
  } catch (err) {
    console.error('⚠️ Error:', err.message);
  }
}

// ✅ Crawl one letter's index page
async function crawlIndex(letter) {
  const indexUrl = `https://en.wiktionary.org/wiki/Index:${letter}`;
  console.log(`🔤 Crawling Index:${letter}`);
  try {
    const res = await fetch(indexUrl);
    if (!res.ok) return;
    const html = await res.text();
    const $ = cheerio.load(html);

    const links = $('a[href^="/wiki/"]')
      .map((_, el) => new URL($(el).attr('href'), 'https://en.wiktionary.org').href)
      .get()
      .filter(link =>
        !link.includes(':') && // avoids meta pages
        !link.includes('#') &&
        !link.includes('Wiktionary')
      );

    for (const link of links) {
      await crawlWord(link);
    }

    await saveCheckpoint(letter);
  } catch (err) {
    console.error(`❌ Failed Index:${letter} — ${err.message}`);
  }
}

// ✅ Start loop A to Z
(async () => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const startLetter = await getCheckpoint();
  const startIndex = alphabet.indexOf(startLetter);

  for (let i = startIndex; i < alphabet.length; i++) {
    await crawlIndex(alphabet[i]);
  }

  console.log('✅ Finished A–Z crawl.');
})();
