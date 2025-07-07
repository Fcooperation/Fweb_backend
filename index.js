// index.js
import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { getAnswer } from './fAi.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const GOFILE_TOKEN = 'e1LOiRxizCSLqTmyZ27AeZuN10qu0wfO';
const GOFILE_ACCOUNT_ID = 'd8658556-dc3a-4572-a73e-b52df41d60cc';
let currentFolder = null;
let currentFolderSize = 0;

// Example of 180+ sites (shortened for space)
const siteList = [
  'https://en.wikipedia.org/wiki/',
  'https://www.britannica.com/search?query=',
  'https://www.livescience.com/search?searchTerm=',
  'https://www.reuters.com/search/news?blob=',
  'https://edition.cnn.com/search?q=',
  'https://stackoverflow.com/search?q=',
  'https://www.quora.com/search?q=',
  'https://www.khanacademy.org/search?page_search_query=',
  'https://www.investopedia.com/search?q=',
  'https://dictionary.cambridge.org/dictionary/english/',
  'https://www.collinsdictionary.com/dictionary/english/',
  'https://www.sciencedaily.com/search/?keyword=',
  'https://www.imdb.com/find?q=',
  'https://www.bbc.com/search?q=',
  'https://news.ycombinator.com/',
  // ...add the rest of your 180+ URLs here
];

async function ensureFolder() {
  if (currentFolder && currentFolderSize < 9500 * 1024 * 1024) return currentFolder;
  try {
    const res = await axios.get(`https://api.gofile.io/createFolder?token=${GOFILE_TOKEN}`);
    const folder = res.data.data.id;
    currentFolder = folder;
    currentFolderSize = 0;
    return folder;
  } catch (err) {
    console.error('❌ Error creating Gofile folder:', err.message);
    return null;
  }
}

async function uploadToGofile(dataObj) {
  try {
    const folder = await ensureFolder();
    if (!folder) return;
    const filename = `fAi_${Date.now()}.json`;
    const filePath = path.join('/tmp', filename);
    fs.writeFileSync(filePath, JSON.stringify(dataObj, null, 2));

    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('folderId', folder);
    form.append('token', GOFILE_TOKEN);

    await axios.post('https://api.gofile.io/uploadFile', form, {
      headers: form.getHeaders()
    });

    const uploadedSize = fs.statSync(filePath).size;
    currentFolderSize += uploadedSize;
    fs.unlinkSync(filePath);
  } catch (err) {
    console.error('❌ Upload to Gofile failed:', err.message);
  }
}

function detectCategories(rawText) {
  const categories = [];
  const lower = rawText.toLowerCase();

  if (lower.includes('forum') || lower.includes('thread')) categories.push('forums');
  if (lower.includes('news') || lower.includes('headline')) categories.push('news');
  if (lower.includes('book') || lower.includes('novel')) categories.push('books');
  if (lower.includes('define') || lower.includes('definition')) categories.push('definitions');
  if (lower.includes('explain') || lower.includes('tutorial')) categories.push('tutorials');
  if (lower.includes('video') || lower.includes('watch')) categories.push('videos');
  if (lower.includes('image') || lower.includes('.jpg') || lower.includes('.png')) categories.push('images');
  if (lower.includes('article') || lower.includes('published')) categories.push('articles');
  if (lower.includes('meaning') || lower.includes('dictionary')) categories.push('dictionary');

  return [...new Set(categories)];
}

async function scrapeContent(query) {
  const results = [];
  const mergedImages = new Set();
  const allCategories = new Set();
  let finalText = '';
  let sourceLinks = [];

  for (const base of siteList) {
    const url = base + encodeURIComponent(query);
    try {
      const htmlRes = await axios.get(url, { timeout: 7000 });
      const $ = cheerio.load(htmlRes.data);
      const text = $('body').text();
      const categories = detectCategories(text);
      categories.forEach(c => allCategories.add(c));
      sourceLinks.push(url);

      finalText += `\n\n[From ${url}]\n` + text.slice(0, 500); // first 500 chars

      $('#mw-content-text img, img').each((_, el) => {
        const src = $(el).attr('src');
        if (src && !src.includes('icon') && !src.includes('logo')) {
          const fullSrc = src.startsWith('http') ? src : `https:${src}`;
          if (!mergedImages.has(fullSrc)) mergedImages.add(fullSrc);
        }
      });
    } catch (e) {
      continue; // skip failed requests
    }

    if (results.length >= 10) break; // Limit to 10 results for speed
  }

  return {
    rawText: finalText.trim(),
    images: Array.from(mergedImages).slice(0, 20),
    categories: Array.from(allCategories),
    source: sourceLinks[0] || null
  };
}

app.post('/search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Missing query.' });

  const aiData = await getAnswer(query);
  const scraped = await scrapeContent(query);

  const payload = {
    query,
    title: aiData?.title || '',
    answer: aiData?.main || '',
    images: scraped.images,
    categories: scraped.categories,
    rawText: scraped.rawText,
    source: scraped.source,
    timestamp: new Date().toISOString()
  };

  uploadToGofile(payload);

  res.json({
    response: aiData?.main || '',
    title: aiData?.title || '',
    images: scraped.images,
    categories: scraped.categories,
    source: scraped.source,
    related: []
  });
});

app.listen(PORT, () => {
  console.log(`🚀 fAi server running on port ${PORT}`);
});
