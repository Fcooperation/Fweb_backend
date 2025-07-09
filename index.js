import express from 'express';
import axios from 'axios';
import cors from 'cors';
import { exec } from 'child_process'; // Needed to run fAi.js

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
    const summaryRes = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestTitle)}`);
    const summaryData = summaryRes.data;

    const main = summaryData.extract || "No summary found.";
    const image = summaryData.originalimage?.source || null;
    const source = summaryData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${bestTitle.replace(/ /g, "_")}`;
    const categories = detectCategories(main);

    return { main, image, title: bestTitle, source, categories };

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
    images: data.image ? [data.image] : [],
    source: data.source,
    title: data.title,
    categories: data.categories
  });
});

// 🔥 This endpoint runs fAi.js when user is online
app.post('/online', (req, res) => {
  console.log("📶 User is online — starting fAi.js...");

  exec('node fAi.js', (err, stdout, stderr) => {
    if (err) {
      console.error(`❌ fAi.js error:\n${stderr}`);
      return res.status(500).send('Failed to run fAi.js');
    }
    console.log(`✅ fAi.js output:\n${stdout}`);
    res.send('fAi.js started successfully');
  });
});

app.listen(PORT, () => {
  console.log(`🚀 fAi backend running at port ${PORT}`);
});
