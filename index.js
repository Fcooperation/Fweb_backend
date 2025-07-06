import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

function detectCategories(text) {
  const categories = [];
  const lower = text.toLowerCase();
  if (lower.includes('forum') || lower.includes('discussion')) categories.push('forums');
  if (lower.includes('news') || lower.includes('reported') || lower.includes('breaking')) categories.push('news');
  if (lower.includes('book') || lower.includes('novel') || lower.includes('published')) categories.push('books');
  return categories;
}

async function getSmartCrawl(query) {
  console.log(`🔍 Smart crawling: "${query}"`);

  try {
    // 1. Search for the page title
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
    const encodedTitle = encodeURIComponent(bestTitle);
    const wikiPageUrl = `https://en.wikipedia.org/wiki/${bestTitle.replace(/ /g, '_')}`;

    // 2. Fetch smart summary
    const summaryRes = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`);
    const summaryData = summaryRes.data;

    const main = summaryData.extract || "No summary found.";
    const source = summaryData.content_urls?.desktop?.page || wikiPageUrl;
    const categories = detectCategories(main);

    // 3. Scrape up to 20 images from the full article
    const htmlRes = await axios.get(wikiPageUrl);
    const $ = cheerio.load(htmlRes.data);
    const images = [];

    $('#mw-content-text img').each((_, el) => {
      if (images.length >= 20) return;
      const src = $(el).attr('src') || '';
      if (src && !src.includes('icon') && !src.includes('logo') && !src.includes('wikimedia-button')) {
        const fullSrc = src.startsWith('http') ? src : `https:${src}`;
        images.push(fullSrc);
      }
    });

    return {
      main,
      images,
      title: bestTitle,
      source,
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
