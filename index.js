import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import cors from 'cors';
import { getAnswer } from './fai.js'; // 👈 Importing from fAi

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

function detectCategories(htmlText) {
  const categories = [];
  const lower = htmlText.toLowerCase();

  if (lower.includes('forum') || lower.includes('discussion')) {
    categories.push('forums');
  }
  if (lower.includes('news') || lower.includes('breaking') || lower.includes('headline')) {
    categories.push('news');
  }
  if (lower.includes('book') || lower.includes('novel') || lower.includes('published')) {
    categories.push('books');
  }

  return categories;
}

async function getImagesAndCategories(wikiUrl) {
  try {
    const htmlRes = await axios.get(wikiUrl);
    const $ = cheerio.load(htmlRes.data);

    const rawText = $('body').text();
    const categories = detectCategories(rawText);

    const images = [];
    $('#mw-content-text img').each((_, el) => {
      if (images.length >= 20) return;
      const src = $(el).attr('src') || '';
      if (src && !src.includes('icon') && !src.includes('logo') && !src.includes('wikimedia-button')) {
        const fullSrc = src.startsWith('http') ? src : `https:${src}`;
        images.push(fullSrc);
      }
    });

    return { images, categories };

  } catch (err) {
    console.error(`❌ Error scraping article: ${err.message}`);
    return { images: [], categories: [] };
  }
}

app.post('/search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Missing query.' });

  const aiData = await getAnswer(query);
  if (!aiData) {
    return res.json({
      response: `❌ Couldn't find anything for "${query}"`,
      related: [],
      images: [],
      categories: [],
      source: null
    });
  }

  const { images, categories } = await getImagesAndCategories(aiData.source);

  res.json({
    response: aiData.main,
    related: [],
    images,
    title: aiData.title,
    source: aiData.source,
    categories
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Fserver running on port ${PORT}`);
});
