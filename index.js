import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';

// === Supabase credentials (yours) ===
const supabase = createClient(
  'https://prbivxwflpqksxbghpwy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ'
);

// === Config ===
const START_URL = 'https://en.wiktionary.org/wiki/apple';
const BASE_URL = 'https://en.wiktionary.org';
const visited = new Set();

// === Supabase helpers ===
async function isVisited(url) {
  const { data } = await supabase
    .from('fai_visited')
    .select('url')
    .eq('url', url)
    .maybeSingle();
  return !!data;
}

async function markVisited(url) {
  await supabase.from('fai_visited').insert([{ url }]);
}

async function uploadEntry(entry) {
  const { data: existing } = await supabase
    .from('ftraining')
    .select('id')
    .eq('word', entry.word)
    .eq('url', entry.url)
    .limit(1);
  if (existing && existing.length > 0) return;
  await supabase.from('ftraining').insert([entry]);
}

// === Main crawler ===
async function crawl(url, depth = 1) {
  if (visited.has(url) || depth <= 0 || await isVisited(url)) return;
  visited.add(url);
  await markVisited(url);

  try {
    console.log(`🔗 Crawling word: ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`❌ Failed: ${res.status} ${url}`);
      return;
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const title = $('title').text().replace(' - Wiktionary, the free dictionary', '').trim();
    const previewText = $('#mw-content-text').text().slice(0, 300);
    const definitions = [];
    const examples = [];
    const anagrams = [];
    let pronunciation = '';
    let language = '';
    let languageSection = '';
    let wordType = '';
    let audio = '';

    $('h2, h3, h4, ul, ol, p').each((_, el) => {
      const tag = $(el).prop('tagName');

      if (tag === 'H2' && $(el).text().includes('English')) {
        language = 'English';
        languageSection = $(el).text();
      }

      if (tag === 'H3' && $(el).text().includes('Pronunciation')) {
        const next = $(el).nextUntil('h3, h2');
        pronunciation = next.text().trim();
        const audioEl = next.find('audio source');
        if (audioEl.length > 0) {
          audio = BASE_URL + audioEl.attr('src');
        }
      }

      if (tag === 'H3' && $(el).text().match(/Noun|Verb|Adjective|Adverb|Interjection/)) {
        wordType = $(el).text().trim();
      }

      if ((tag === 'UL' || tag === 'OL') && language === 'English') {
        $(el).find('li').each((_, li) => {
          const text = $(li).text().trim();
          if (text.length > 0) definitions.push(text);
        });
      }

      if (tag === 'H3' && $(el).text().includes('Anagrams')) {
        $(el).next('ul').find('li').each((_, li) => {
          const text = $(li).text().trim();
          if (text) anagrams.push(text);
        });
      }
    });

    const entry = {
      word: title,
      language,
      type: wordType,
      definitions,
      pronunciation,
      examples,
      anagrams,
      url,
      timestamp: new Date().toISOString(),
      is_abbreviation: title.toLowerCase().includes('abbr'),
      is_phrase: title.includes(' ') || title.includes('-'),
      language_section: languageSection
    };

    await uploadEntry(entry);
    console.log(`✅ Uploaded: ${title} | ${definitions.length} defs`);

    // Follow more dictionary words
    const links = [];
    $('a[href^="/wiki/"]').each((_, a) => {
      const href = $(a).attr('href');
      if (
        href &&
        !href.includes(':') &&
        !href.includes('#') &&
        /^[\/]wiki\/[A-Za-z0-9\-_'’]+$/.test(href)
      ) {
        links.push(new URL(href, BASE_URL).toString());
      }
    });

    for (const link of links.slice(0, 10)) {
      await crawl(link, depth - 1);
    }

  } catch (err) {
    console.error(`⚠️ Error on ${url}: ${err.message}`);
  }
}

// Start crawling
crawl(START_URL, 3);
