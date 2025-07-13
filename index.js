import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';

const supabase = createClient(
  'https://pwsxezhugsxosbwhkdvf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ' // Replace this with your actual secret key
);

// ✅ Get checkpoint
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
  await supabase.from('fai_checkpoint').upsert({ id: 1, url });
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
  await supabase.from('fai_visited').upsert({ url });
}

// ✅ Check word exists
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
  if (error) console.error('Upload error:', error.message);
  else console.log(`✅ Uploaded: ${entry.word}`);
}

// ✅ Crawl dictionary page
async function crawlPage(url) {
  console.log(`🔎 Crawling directory: ${url}`);
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);

  const links = [];
  $('#mw-content-text a').each((_, el) => {
    const title = $(el).text().trim();
    const href = $(el).attr('href');

    // Skip meta pages or titles with non-word chars
    if (
      /^[a-zA-Z]+$/.test(title) && // only pure words
      href?.startsWith('/wiki/') &&
      !href.includes(':') &&
      !href.includes('#')
    ) {
      const fullUrl = new URL(href, 'https://en.wiktionary.org').href;
      links.push({ word: title, url: fullUrl });
    }
  });

  console.log(`🔗 Found ${links.length} valid word links`);

  // Crawl each word page
  for (const link of links) {
    if (await isVisited(link.url)) continue;
    await markVisited(link.url);

    try {
      const res = await fetch(link.url);
      const html = await res.text();
      const $ = cheerio.load(html);

      const word = $('h1').first().text().trim();
      const title = $('title').text();
      const pronunciation = $('span.IPA').first().text().trim();
      const type = $('span.headword-line').first().text().trim();
      const definitions = [];

      $('ol > li').each((_, el) => {
        const def = $(el).clone().find('ul, dl').remove().end().text().trim();
        if (def) definitions.push(def);
      });

      const examples = [];
      $('li:contains("Usage notes") ~ ul li').each((_, el) => {
        const example = $(el).text().trim();
        if (example) examples.push(example);
      });

      const is_abbreviation = title.toLowerCase().includes('abbreviation');
      const is_phrase = word.includes(' ');

      if (!await wordExists(word)) {
        await uploadEntry({
          word,
          language: 'English',
          type,
          definitions,
          pronunciation,
          examples,
          url: link.url,
          is_abbreviation,
          is_phrase,
          language_section: 'English'
        });
      }

    } catch (err) {
      console.error(`⚠️ Failed to crawl ${link.url}: ${err.message}`);
    }
  }

  // Next page
  const nextHref = $('a:contains("next page")').attr('href');
  if (nextHref) {
    const nextUrl = new URL(nextHref, 'https://en.wiktionary.org').href;
    await saveCheckpoint(nextUrl);
    await crawlPage(nextUrl); // recursive
  } else {
    console.log('✅ Finished crawling all pages.');
  }
}

// ✅ START
const startUrl = await getCheckpoint();
await crawlPage(startUrl);

// Optional: keep alive on Render
setTimeout(() => console.log('🕓 Done'), 1000);
