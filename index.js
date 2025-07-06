import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

function cleanText(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, '');
}

function scoreSentence(sentence, query) {
  const queryWords = new Set(cleanText(query).split(/\s+/));
  const sentenceWords = new Set(cleanText(sentence).split(/\s+/));
  let score = 0;
  queryWords.forEach(word => {
    if (sentenceWords.has(word)) score++;
  });
  return score;
}

function detectCategories(text) {
  const categories = [];
  const lower = text.toLowerCase();
  if (lower.includes('forum') || lower.includes('discussion')) categories.push('forums');
  if (lower.includes('news') || lower.includes('reported')) categories.push('news');
  if (lower.includes('book') || lower.includes('novel') || lower.includes('textbook')) categories.push('books');
  return categories;
}

async function getSmartCrawl(query) {
  console.log(`🔍 Smart crawling: "${query}"`);

  try {
    const searchRes = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        list: 'search',
        srsearch: query,
        format: 'json',
      }
    });

    const results = searchRes.data.query.search;
    if (!results || results.length === 0) return null;

    const bestTitle = results[0].title;
    const pageUrl = `https://en.wikipedia.org/wiki/${bestTitle.replace(/ /g, '_')}`;

    const { data: html } = await axios.get(pageUrl);
    const $ = cheerio.load(html);

    const allSentences = [];
    $('p').each((_, el) => {
      const text = $(el).text().trim();
      const sentences = text.split(/(?<=[.?!])\s+/).filter(s => s.length >= 30 && s.includes('.'));
      allSentences.push(...sentences);
    });

    if (allSentences.length === 0) return null;

    const scored = allSentences.map(s => ({
      text: s.trim(),
      score: scoreSentence(s, query)
    })).sort((a, b) => b.score - a.score);

    const bestSentence = scored.find(s => s.score > 0) || scored[0];

    const images = [];
    $('#mw-content-text img').each((_, el) => {
      const src = $(el).attr('src') || '';
      if (src && !src.includes('icon') && !src.includes('logo')) {
        images.push(src.startsWith('http') ? src : `https:${src}`);
      }
    });

    const joinedText = allSentences.join(' ');
    const categories = detectCategories(joinedText);

    return {
      main: bestSentence.text,
      related: [],
      images: [...new Set(images)].slice(0, 20),
      source: pageUrl,
      title: bestTitle,
      categories
    };
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    return null;
  }
}

app.post('/search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Missing query.' });

  const data = await getSmartCrawl(query);
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
    images: data.images,
    source: data.source,
    title: data.title,
    categories: data.categories
  });
});

app.listen(PORT, () => {
  console.log(`🚀 fAi backend running at port ${PORT}`);
});
