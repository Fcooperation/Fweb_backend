import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';

const supabase = createClient(
  'https://pwsxezhugsxosbwhkdvf.supabase.co',
  'YOUR_SUPABASE_KEY'
);

const BASE = 'https://en.wiktionary.org';

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
  if (error) console.error('⛔ Upload error:', error.message);
  else console.log(`✅ Uploaded: ${entry.word}`);
}

async function crawlWordPage(url) {
  if (await isVisited(url)) return;
  await markVisited(url);

  try {
    const res = await fetch(url);
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
        definitions,
        pronunciation,
        examples,
        anagrams,
        url,
        is_abbreviation,
        is_phrase,
        language_section: 'English',
      });
    }

    // Crawl further internal links
    const nextLinks = new Set();
    $('a[href^="/wiki/"]').each((_, el) => {
      const href = $(el).attr('href');
      const title = decodeURIComponent(href.split('/wiki/')[1] || '');
      if (
        /^[a-zA-Z\u00C0-\u017F'’-]+$/.test(title) &&
        !href.includes(':') &&
        !href.includes('#')
      ) {
        nextLinks.add(new URL(href, BASE).href);
      }
    });

    for (const link of Array.from(nextLinks)) {
      await crawlWordPage(link);
    }

  } catch (err) {
    console.error('⚠️ Error crawling:', err.message);
  }
}

async function crawlAllPages() {
  const directoryURL = `${BASE}/wiki/Special:AllPages?from=&to=&namespace=0`;
  console.log(`🔎 Crawling directory: ${directoryURL}`);

  try {
    const res = await fetch(directoryURL);
    const html = await res.text();
    const $ = cheerio.load(html);

    const links = [];
    $('#mw-content-text a').each((_, el) => {
      const href = $(el).attr('href');
      const title = decodeURIComponent(href?.split('/wiki/')[1] || '');

      if (
        href?.startsWith('/wiki/') &&
        /^[a-zA-Z\u00C0-\u017F'’-]+$/.test(title) &&
        !href.includes(':') &&
        !href.includes('#')
      ) {
        links.push(new URL(href, BASE).href);
      }
    });

    console.log(`🔗 Found ${links.length} valid word links`);
    for (const link of links) {
      await crawlWordPage(link);
    }

  } catch (err) {
    console.error('❌ Failed to crawl directory:', err.message);
  }

  console.log('✅ Finished crawling all pages.');
}

await crawlAllPages();
setTimeout(() => console.log('🕓 Done'), 1000);
