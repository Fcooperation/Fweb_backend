import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';

// ✅ Supabase client
const supabase = createClient(
  'https://pwsxezhugsxosbwhkdvf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ'
);

// ✅ Load checkpoint
async function getCheckpoint() {
  const { data } = await supabase
    .from('fai_checkpoint')
    .select('url')
    .eq('id', 1)
    .single();
  return data?.url || 'https://en.wiktionary.org/wiki/Wiktionary:All_pages';
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

// ✅ Check if already uploaded
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
  const { error } = await supabase
    .from('ftraining')
    .insert(entry);
  if (error) {
    console.error('❌ Upload error:', error.message);
  } else {
    console.log(`✅ Uploaded: ${entry.word} (${entry.definitions.length} defs)`);
  }
}

// ✅ Detect if link is meta (Wiktionary:, Category:, etc.)
function isMetaLink(href) {
  return href.includes(':') && !href.startsWith('/wiki/Wiktionary:All_pages');
}

// ✅ Crawl function
async function crawl(url) {
  const visited = await isVisited(url);

  if (!visited) {
    await markVisited(url);
    await saveCheckpoint(url);
  } else {
    console.log(`⚠️ Already visited: ${url}`);
  }

  try {
    console.log(`🔗 Crawling: ${url}`);
    const res = await fetch(url);
    if (!res.ok) return;

    const html = await res.text();
    const $ = cheerio.load(html);

    // ✅ Try extracting word entry if it's a definition page
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

    // ✅ Only upload if not already uploaded and this isn't a meta/help page
    if (
      !visited &&
      !await wordExists(word) &&
      !url.includes('Wiktionary:') &&
      !url.includes('Category:') &&
      definitions.length > 0
    ) {
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

    // ✅ Crawl all internal links (excluding meta pages)
    const nextLinks = new Set();
    $('a[href^="/wiki/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!isMetaLink(href) && !href.includes('#')) {
        const link = new URL(href, 'https://en.wiktionary.org').href;
        nextLinks.add(link);
      }
    });

    for (const link of nextLinks) {
      await crawl(link);
    }

  } catch (err) {
    console.error('⚠️ Error:', err.message);
  }
}

// ✅ Start the crawl
const start = await getCheckpoint();
console.log(`🚀 Resuming crawl from: ${start}`);
await crawl(start);

// ✅ Prevent Render shutdown
setInterval(() => {
  console.log('⏳ Still running...');
}, 60_000); // every 1 minute
