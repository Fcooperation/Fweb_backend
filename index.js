import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import cors from 'cors';

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

async function getSmartCrawl(query) {
  console.log(`🔍 Smart crawling: "${query}"`);

  try {
    // Step 1: Search Wikipedia for best title
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

    // Step 2: Fetch smart summary from REST API
    const summaryRes = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`);
    const summaryData = summaryRes.data;

    const main = summaryData.extract?.split('. ')[0] + '.' || "No summary found.";
    const source = summaryData.content_urls?.desktop?.page || wikiPageUrl;

    // Step 3: Fetch full HTML and extract images and categories
    const htmlRes = await axios.get(wikiPageUrl);
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
  if (!query) {
    return res.status(400).json({ error: 'Missing query.' });
  }

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
