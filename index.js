import axios from 'axios';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import { nanoid } from 'nanoid';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';
import http from 'http'; // 🔓 Required for port opening

// 🔐 Supabase credentials
const supabase = createClient(
'https://pwsxezhugsxosbwhkdvf.supabase.co',
'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ'
);

// 🌍 Rich English content starting points
const SITES = [
  "https://en.wiktionary.org/wiki/Category:English_lemmas"
];
// 🧠 Memory of visited URLs
const visited = new Set();

// 🧮 Token estimator
function countTokens(text) {
return Math.ceil(text.length / 4);
}

// 🧹 Extract <title> and <p> text content
function extractTrainingData(html) {
const $ = cheerio.load(html);
const title = $('title').text().trim();
let bodyText = '';
$('p').each((_, el) => {
const txt = $(el).text().trim();
if (txt.length > 1) bodyText += txt + '\n';
});
return { title, content: bodyText.trim() };
}

// 📤 Upload to Supabase
async function uploadToSupabase(entry) {
const { data: existing } = await supabase
.from('fai_training')
.select('id')
.eq('url', entry.url)
.limit(1);

if (!existing || existing.length === 0) {
await supabase.from('fai_training').insert([entry]);
await supabase.from('fai_visited').insert([{ url: entry.url }]);
console.log(📤 Uploaded: ${entry.url});
} else {
console.log(⚠️ Duplicate: ${entry.url});
}
}

// 📜 Get and parse robots.txt
async function getRobots(url) {
try {
const robotsUrl = new URL('/robots.txt', url).href;
const res = await axios.get(robotsUrl);
const parser = robotsParser(robotsUrl, res.data);
const delay = parser.getCrawlDelay('fcrawler') || 1500;
return { parser, delay };
} catch {
return { parser: { isAllowed: () => true }, delay: 1500 };
}
}

// 🧠 Fallback API (for future API handling)
async function fallbackAPI(url) {
try {
if (url.includes('Special:Random')) {
const res = await axios.get('https://en.wikipedia.org/api/rest_v1/page/random/summary');
return {
title: res.data.title,
content: res.data.extract,
url: res.data.content_urls.desktop.page,
tokens: countTokens(res.data.extract)
};
}
return null;
} catch (err) {
console.warn(⚠️ Fallback failed for ${url}: ${err.message});
return null;
}
}

// 🔁 Crawl a single URL
async function crawl(url, robots, delay) {
const cleanUrl = url.split('#')[0];
if (visited.has(cleanUrl)) return;
visited.add(cleanUrl);

if (!robots.parser.isAllowed(cleanUrl, 'fcrawler')) {
console.log(🚫 Disallowed by robots.txt: ${cleanUrl});
const fallback = await fallbackAPI(cleanUrl);
if (fallback && fallback.tokens > 0) {
await uploadToSupabase({
id: nanoid(),
url: fallback.url,
title: fallback.title,
content: fallback.content,
tokens: fallback.tokens,
timestamp: new Date().toISOString()
});
}
return;
}

try {
console.log(🔍 Crawling: ${cleanUrl});
const res = await axios.get(cleanUrl);
const { title, content } = extractTrainingData(res.data);
const tokens = countTokens(content);
if (tokens < 1) return;

await uploadToSupabase({  
  id: nanoid(),  
  url: cleanUrl,  
  title,  
  content,  
  tokens,  
  timestamp: new Date().toISOString()  
});  

const $ = cheerio.load(res.data);  
const links = $('a[href]')  
  .map((_, el) => $(el).attr('href'))  
  .get()  
  .map(href => {  
    try {  
      const full = new URL(href, cleanUrl).href;  
      return full.split('#')[0];  
    } catch {  
      return null;  
    }  
  })  
  .filter(Boolean)  
  .filter(href => href.startsWith('https://en.wikipedia.org/wiki/'));  

for (const link of links) {  
  await new Promise(r => setTimeout(r, delay));  
  await crawl(link, robots, delay);  
}

} catch (err) {
console.warn(❌ Failed to crawl ${cleanUrl}: ${err.message});
}
}

// 🚀 Start crawler + open port
(async () => {
console.log('🕷️ crawlerA booting...');
const { data } = await supabase.from('fai_visited').select('url').limit(100000);
data?.forEach(d => visited.add(d.url.split('#')[0]));
console.log(📚 Loaded ${visited.size} visited URLs);

for (const site of SITES) {
const robots = await getRobots(site);
await crawl(site, robots, robots.delay);
}

// 🔓 Keep port open for platforms like Render
const PORT = process.env.PORT || 3000;
http.createServer((_, res) => {
res.writeHead(200);
res.end('crawlerA is running.\n');
}).listen(PORT, () => {
console.log(🔓 Port opened on ${PORT});
});
})();

