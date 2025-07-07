// index.js
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
  if (lower.includes('dictionary') || lower.includes('define') || lower.includes('meaning')) {
    categories.push('dictionary');
  }
  return categories;
}

async function getDictionaryDefinition(query) {
  try {
    const url = `https://www.merriam-webster.com/dictionary/${encodeURIComponent(query)}`;
    const { data: html } = await axios.get(url, { timeout: 10000 });

    const $ = cheerio.load(html);

    // Try to grab first definition block
    const definition = $('.vg .dtText').first().text().trim().replace(/^:\s*/, '');
    const example = $('.ex-sent.t.has-aq').first().text().trim();

    if (!definition) return null;

    const images = [];
    $('img').each((_, el) => {
      const src = $(el).attr('src');
      if (src && !src.includes('logo') && !src.includes('icon')) {
        images.push(src.startsWith('http') ? src : `https:${src}`);
      }
    });

    return {
      title: query,
      main: definition,
      example,
      images: images.slice(0, 10),
      source: url,
      categories: detectCategories(definition + ' ' + example)
    };
  } catch (err) {
    console.error(`❌ Error fetching dictionary entry: ${err.message}`);
    return null;
  }
}

app.post('/search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Missing query.' });

  const result = await getDictionaryDefinition(query);
  if (!result) {
    return res.json({
      response: `❌ No dictionary definition found for "${query}"`,
      related: [],
      images: [],
      categories: [],
      source: null
    });
  }

  res.json({
    response: result.main,
    related: result.example ? [result.example] : [],
    images: result.images,
    source: result.source,
    title: result.title,
    categories: result.categories
  });
});

app.listen(PORT, () => {
  console.log(`📚 Dictionary backend running on port ${PORT}`);
});
