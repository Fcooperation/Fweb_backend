import express from 'express';
import axios from 'axios';
import cheerio from 'cheerio';
import robotsParser from 'robots-parser';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

const CATEGORIES = {
  news: ['bbc.com', 'cnn.com', 'reuters.com', 'theguardian.com', 'nytimes.com'],
  books: ['gutenberg.org', 'openlibrary.org', 'manybooks.net', 'bartleby.com'],
  science: ['sciencedaily.com', 'arxiv.org', 'nasa.gov', 'nature.com'],
  health: ['webmd.com', 'mayoclinic.org', 'cdc.gov', 'who.int'],
  general: ['wikipedia.org', 'wiktionary.org', 'britannica.com', 'medium.com']
  // Add more as needed
};

function getCategory(query) {
  const q = query.toLowerCase();
  if (q.includes('covid') || q.includes('symptom')) return 'health';
  if (q.includes('book') || q.includes('read')) return 'books';
  if (q.includes('news') || q.includes('politics')) return 'news';
  if (q.includes('gravity') || q.includes('experiment')) return 'science';
  return 'general';
}

async function obeyRobotsTxt(url) {
  try {
    const base = new URL(url).origin;
    const { data } = await axios.get(`${base}/robots.txt`);
    const robots = robotsParser(`${base}/robots.txt`, data);
    return robots.isAllowed(url, '*');
  } catch {
    return true;
  }
}

async function extractSentencesFromPage(url, query) {
  try {
    const allowed = await obeyRobotsTxt(url);
    if (!allowed) return null;

    const { data } = await axios.get(url, { timeout: 5000 });
    const $ = cheerio.load(data);

    let texts = [];
    $('p, li, h2, h3').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 40 && text.toLowerCase().includes(query.toLowerCase())) {
        texts.push({ sentence: text, source: url });
      }
    });

    return texts;
  } catch {
    return null;
  }
}

async function findAnswers(query) {
  const category = getCategory(query);
  const sites = CATEGORIES[category] || CATEGORIES['general'];

  const results = [];
  for (let site of sites) {
    const searchURL = `https://www.google.com/search?q=site:${site}+${encodeURIComponent(query)}`;
    try {
      const { data } = await axios.get(searchURL, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const $ = cheerio.load(data);
      const links = [];

      $('a').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.startsWith('/url?q=')) {
          const clean = decodeURIComponent(href.split('/url?q=')[1].split('&')[0]);
          if (!clean.includes('google')) links.push(clean);
        }
      });

      for (let link of links.slice(0, 2)) {
        const sentences = await extractSentencesFromPage(link, query);
        if (sentences) results.push(...sentences);
      }
    } catch (err) {
      continue;
    }
  }

  return results;
}

app.post('/search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'No query provided.' });

  const found = await findAnswers(query);
  if (!found || found.length === 0) {
    return res.json({
      mainAnswer: `❌ No results found for "${query}".`,
      otherAnswers: [],
      sources: []
    });
  }

  const mainAnswer = found[0].sentence;
  const sources = [...new Set(found.map(f => f.source))];
  const otherAnswers = found.slice(1, 5).map(f => f.sentence);

  res.json({
    mainAnswer,
    otherAnswers,
    sources
  });
});

app.listen(PORT, () => {
  console.log(`🧠 fAi server running on port ${PORT}`);
});
