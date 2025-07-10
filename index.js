import express from 'express';
import axios from 'axios';
import cors from 'cors';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import { nanoid } from 'nanoid';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 🔐 Supabase setup
const supabaseUrl = 'https://pwsxezhugsxosbwhkdvf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ'; // Replace with your actual Supabase key
const supabase = createClient(supabaseUrl, supabaseKey);

// 🌍 Sites to crawl (updated fresh links)
const SITES = [
  // 🌍 Science & Research
  "https://en.wikipedia.org/wiki/Science",
  "https://pubmed.ncbi.nlm.nih.gov/",
  "https://arxiv.org/",
  "https://www.nature.com/",
  "https://www.sciencedirect.com/",
  "https://www.sciencemag.org/",
  "https://plos.org/",
  "https://www.researchgate.net/",
  "https://www.nih.gov/",
  "https://www.nasa.gov/",

  // 💻 Technology & Computing
  "https://en.wikipedia.org/wiki/Computer_science",
  "https://stackoverflow.com/",
  "https://github.com/",
  "https://techcrunch.com/",
  "https://arstechnica.com/",
  "https://www.wired.com/",
  "https://infoq.com/",
  "https://news.ycombinator.com/",
  "https://acm.org/",
  "https://ieeexplore.ieee.org/",

  // 🏛️ History & Culture
  "https://en.wikipedia.org/wiki/History",
  "https://www.britannica.com/",
  "https://www.history.com/",
  "https://plato.stanford.edu/",
  "https://www.bbc.co.uk/history",
  "https://www.worldhistory.org/",
  "https://www.si.edu/",
  "https://www.jstor.org/",
  "https://artsandculture.google.com/",
  "https://civilisations.ca/",

  // 🎨 Arts & Literature
  "https://www.gutenberg.org/",
  "https://www.poetryfoundation.org/",
  "https://www.poetryarchive.org/",
  "https://lithub.com/",
  "https://www.theparisreview.org/",
  "https://www.goodreads.com/",
  "https://openlibrary.org/",
  "https://poetry.org/",
  "https://www.litencyc.com/",
  "https://www.poets.org/",

  // 🧬 Health & Medicine
  "https://pubmed.ncbi.nlm.nih.gov/",
  "https://www.mayoclinic.org/",
  "https://www.webmd.com/",
  "https://my.clevelandclinic.org/",
  "https://www.nih.gov/",
  "https://www.who.int/",
  "https://medlineplus.gov/",
  "https://www.cdc.gov/",
  "https://www.health.gov/",
  "https://www.sciencedirect.com/journal/the-lancet",

  // ➗ Mathematics & Statistics
  "https://en.wikipedia.org/wiki/Mathematics",
  "https://mathworld.wolfram.com/",
  "https://www.khanacademy.org/math",
  "https://math.stackexchange.com/",
  "https://arxiv.org/archive/math",
  "https://www.ams.org/",
  "https://projecteuler.net/",
  "https://brilliant.org/",
  "https://www.oecd.org/statistics/",
  "https://www.sosmath.com/",

  // 🔧 Engineering & Technology
  "https://www.engineering.com/",
  "https://www.asme.org/",
  "https://www.ieee.org/",
  "https://ocw.mit.edu/",
  "https://www.coursera.org/browse/engineering",
  "https://www.edx.org/learn/engineering",
  "https://www.nasa.gov/topics/technology",
  "https://www.jpl.nasa.gov/",
  "https://www.engineeringvillage.com/",
  "https://www.civilengineeringportal.com/",

  // 🌱 Environment & Earth Science
  "https://earthobservatory.nasa.gov/",
  "https://www.epa.gov/",
  "https://www.usgs.gov/",
  "https://www.noaa.gov/",
  "https://www.nature.com/subjects/environmental-sciences",
  "https://www.sciencedirect.com/journal/environmental-research",
  "https://www.worldwildlife.org/",
  "https://www.unep.org/",
  "https://www.ipcc.ch/",
  "https://www.environmentalscience.org/",

  // 💱 Finance & Economics
  "https://en.wikipedia.org/wiki/Economics",
  "https://www.worldbank.org/",
  "https://www.imf.org/",
  "https://www.federalreserve.gov/",
  "https://econpapers.repec.org/",
  "https://www.investopedia.com/",
  "https://www.bloomberg.com/",
  "https://www.ft.com/",
  "https://www.econlib.org/",
  "https://www.nber.org/",

  // 🎓 Education & E-Learning
  "https://www.khanacademy.org/",
  "https://www.coursera.org/",
  "https://www.edx.org/",
  "https://ocw.mit.edu/",
  "https://openstax.org/",
  "https://www.saylor.org/",
  "https://academicearth.org/",
  "https://www.ted.com/",
  "https://www.udacity.com/",
  "https://www.futurelearn.com/"
];
// 🕹️ Pause flag
let isPaused = false;

// 🔢 Token estimator
function countTokens(text) {
  return Math.ceil(text.length / 4);
}

// 🧠 Auto tagger
function detectCategories(text) {
  const categories = [];
  const lower = text.toLowerCase();
  if (lower.includes('forum') || lower.includes('discussion')) categories.push('forums');
  if (lower.includes('news') || lower.includes('breaking')) categories.push('news');
  if (lower.includes('book') || lower.includes('novel')) categories.push('books');
  return categories;
}

// 📄 Extract title and body text
function extractTrainingData(html) {
  const $ = cheerio.load(html);
  const title = $('title').text().trim();
  let bodyText = '';
  $('p').each((_, el) => {
    const txt = $(el).text().trim();
    if (txt.length > 50) bodyText += txt + '\n';
  });
  return { title, content: bodyText.trim().slice(0, 5000) };
}

// 🧭 robots.txt parser
async function getRobots(url) {
  try {
    const robotsUrl = new URL('/robots.txt', url).href;
    const res = await axios.get(robotsUrl);
    const parser = robotsParser(robotsUrl, res.data);
    const delay = parser.getCrawlDelay('fcrawler') || 2000;
    return { parser, delay };
  } catch {
    return { parser: { isAllowed: () => true }, delay: 2000 };
  }
}

// ☁️ Supabase uploader
async function uploadToSupabase(data) {
  try {
    const { data: existing } = await supabase
      .from('fai_training')
      .select('id')
      .eq('url', data.url)
      .limit(1)
      .throwOnError();

    if (!existing || existing.length === 0) {
      await supabase.from('fai_training').insert([data]).throwOnError();
      await supabase.from('fai_visited').insert([{ url: data.url }]).throwOnError();
      console.log(`📤 Uploaded: ${data.url}`);
      return true;
    } else {
      console.log(`⚠️ Duplicate: ${data.url}`);
      return false;
    }
  } catch (err) {
    console.error('❌ Upload error:', err.message || err);
    return false;
  }
}

// 🔍 Supabase table check
async function ensureTables() {
  console.log('⚙️ Checking Supabase tables...');
  try {
    await supabase.from('fai_training').select('id').limit(1);
    console.log('✅ fai_training table exists');
  } catch {
    console.warn('⚠️ fai_training table may not exist');
  }

  try {
    await supabase.from('fai_visited').select('url').limit(1);
    console.log('✅ fai_visited table exists');
  } catch {
    console.warn('⚠️ fai_visited table may not exist');
  }
}

// 🔁 Load visited URLs
const visited = new Set();
async function loadVisitedUrls() {
  try {
    const { data, error } = await supabase.from('fai_visited').select('url').limit(100000);
    if (error) throw error;
    data.forEach(entry => visited.add(entry.url));
    console.log(`📚 Loaded ${visited.size} visited URLs`);
  } catch (err) {
    console.warn('⚠️ Could not load visited URLs:', err.message);
  }
}

// 🕷️ Main crawling engine (no maxPages)
async function crawl(url, robots, delay) {
  if (visited.has(url)) {
    console.log(`⏩ Skipping already visited: ${url}`);
    return;
  }
  if (!robots.parser.isAllowed(url, 'fcrawler')) {
    console.log(`🚫 Disallowed by robots.txt: ${url}`);
    return;
  }

  visited.add(url);
  console.log(`🔍 Crawling: ${url}`);

  while (isPaused) await new Promise(r => setTimeout(r, 100));

  try {
    const res = await axios.get(url, { timeout: 10000 });
    const { title, content } = extractTrainingData(res.data);
    const tokens = countTokens(content);

    if (tokens < 100) {
      console.log(`⚠️ Skipped (weak content): ${url}`);
      return;
    }

    const entry = {
      id: nanoid(),
      url,
      title,
      content,
      tokens,
      timestamp: new Date().toISOString()
    };

    await uploadToSupabase(entry);

    const $ = cheerio.load(res.data);
    const links = $('a[href]')
      .map((_, el) => $(el).attr('href'))
      .get()
      .map(href => {
        try {
          return new URL(href, url).href;
        } catch {
          return null;
        }
      })
      .filter(href => href && href.startsWith('http'));

    for (const link of links) {
      await new Promise(resolve => setTimeout(resolve, delay));
      await crawl(link, robots, delay);
    }
  } catch (err) {
    console.warn(`❌ Failed: ${url} – ${err.message}`);
  }
}

// 🚀 Launch crawler
async function runCrawler(sites = SITES) {
  console.log('🚀 crawlerA starting...');
  await ensureTables();
  await loadVisitedUrls();
  for (const site of sites) {
    const robots = await getRobots(site);
    await crawl(site, robots, robots.delay);
  }
}

// 🔎 Smart Wikipedia search
async function getSmartCrawl(query) {
  console.log(`🔍 Smart crawling: "${query}"`);
  try {
    const searchRes = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        list: 'search',
        srsearch: query,
        format: 'json'
      }
    });

    const results = searchRes.data.query.search;
    if (!results || results.length === 0) return null;

    const bestTitle = results[0].title;
    const summaryRes = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestTitle)}`);
    const summaryData = summaryRes.data;

    const main = summaryData.extract || "No summary found.";
    const image = summaryData.originalimage?.source || null;
    const source = summaryData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${bestTitle.replace(/ /g, "_")}`;
    const categories = detectCategories(main);

    return { main, image, title: bestTitle, source, categories };
  } catch (err) {
    console.error(`❌ Smart crawl error: ${err.message}`);
    return null;
  }
}

// 📡 /search
app.post('/search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Missing query.' });

  isPaused = true;
  const data = await getSmartCrawl(query);
  isPaused = false;

  if (!data) {
    return res.json({
      response: `❌ Couldn't find anything for "${query}"`,
      related: [],
      images: [],
      categories: [],
      source: null
    });
  }

  res.json({
    response: data.main,
    related: [],
    images: data.image ? [data.image] : [],
    source: data.source,
    title: data.title,
    categories: data.categories
  });
});

// ⚡ /online
app.post('/online', async (req, res) => {
  console.log("📶 User is online — starting fAi.js...");
  try {
    await runCrawler();
    res.send('✅ fAi.js (crawler) completed');
  } catch (err) {
    console.error(`❌ fAi.js error:\n${err.message}`);
    res.status(500).send('Failed to run fAi.js');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 fAi backend running at port ${PORT}`);
});
