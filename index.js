import fetch from 'node-fetch'; import * as cheerio from 'cheerio'; import { createClient } from '@supabase/supabase-js'; import { URL } from 'url';

const supabase = createClient( 'https://pwsxezhugsxosbwhkdvf.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ' );

const BASE = 'https://en.wiktionary.org';

async function isVisited(url) { const { data } = await supabase.from('fai_visited').select('url').eq('url', url).maybeSingle(); return !!data; }

async function markVisited(url) { await supabase.from('fai_visited').upsert({ url }); }

async function wordExists(word) { const { data } = await supabase.from('ftraining').select('word').eq('word', word).maybeSingle(); return !!data; }

async function uploadEntry(entry) { const { error } = await supabase.from('ftraining').insert(entry); if (error) console.error('⛔ Upload error:', error.message); else console.log(✅ Uploaded: ${entry.word}); }

async function updateCheckpoint(url) { await supabase.from('fai_checkpoint').upsert({ id: 1, url }); }

async function getCheckpoint() { const { data } = await supabase.from('fai_checkpoint').select('url').eq('id', 1).maybeSingle(); return data?.url || null; }

async function crawlWordPage(url) { if (await isVisited(url)) return; await markVisited(url); await updateCheckpoint(url);

try { const res = await fetch(url); const html = await res.text(); const $ = cheerio.load(html);
const word = $('h1').first().text().trim();   if (!$('#English').length) return;    const englishContent = $('#English').nextUntil('h2');   const pronunciation = englishContent.find('.IPA').first().text().trim();   const type = englishContent.find('.headword-line').first().text().trim();   const definitions = [];   const examples = [];   const anagrams = [];    englishContent.find('ol > li').each((_, el) => {     const def = $(el).clone().find('ul, dl').remove().end().text().trim();     if (def) definitions.push(def);   });    englishContent.find('ul li:contains("Anagrams")').each((_, el) => {     const ana = $(el).text().trim();     if (ana) anagrams.push(ana);   });    englishContent.find('li:contains("Usage notes") ~ ul li').each((_, el) => {     const ex = $(el).text().trim();     if (ex) examples.push(ex);   });    const is_abbreviation = word.toLowerCase().includes('abbr');   const is_phrase = word.includes(' ') || word.includes('-');    if (!await wordExists(word)) {     await uploadEntry({       word,       language: 'English',       type,       definitions,       pronunciation,       examples,       anagrams,       url,       is_abbreviation,       is_phrase,       language_section: 'English'     });   }    // Follow internal valid links   const nextLinks = new Set();   $('a[href^="/wiki/"]').each((_, el) => {     const href = $(el).attr('href');     const title = decodeURIComponent(href.split('/wiki/')[1] || '');     if (       /^[a-zA-Z\u00C0-\u017F'’-]+$/.test(title) &&       !href.includes(':') &&       !href.includes('#')     ) {       nextLinks.add(new URL(href, BASE).href);     }   });    for (const link of nextLinks) {     await crawlWordPage(link);   }   
} catch (err) { console.error('⚠️ Error crawling:', url, err.message); } }

async function crawlAllPages() { const checkpoint = await getCheckpoint(); const directoryURL = ${BASE}/wiki/Special:AllPages?from=&to=&namespace=0; console.log(🔎 Crawling directory: ${directoryURL});

try { const res = await fetch(directoryURL); const html = await res.text(); const $ = cheerio.load(html);
const links = [];   $('#mw-content-text a').each((_, el) => {     const href = $(el).attr('href');     const title = decodeURIComponent(href?.split('/wiki/')[1] || '');     if (       href?.startsWith('/wiki/') &&       /^[a-zA-Z\u00C0-\u017F'’-]+$/.test(title) &&       !href.includes(':') &&       !href.includes('#')     ) {       links.push(new URL(href, BASE).href);     }   });    const startIndex = checkpoint ? links.findIndex(l => l === checkpoint) + 1 : 0;   const crawlQueue = links.slice(startIndex);    console.log(🔗 Resuming from checkpoint... ${crawlQueue.length} remaining);   for (const link of crawlQueue) {     await crawlWordPage(link);     await new Promise(r => setTimeout(r, 150)); // memory-safe delay   }   
} catch (err) { console.error('❌ Failed to crawl directory:', err.message); }

console.log('✅ Finished crawling all pages.'); }

await crawlAllPages(); setTimeout(() => console.log('🕓 Done'), 1000);

