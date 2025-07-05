const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const FormData = require('form-data');

const app = express();
const PORT = process.env.PORT || 3000;
const gofileToken = 'e1LOiRxizCSLqTmyZ27AeZuN10qu0wfO';

app.use(cors());
app.use(express.json());

// Helper: Upload file to Gofile
async function uploadToGofile(buffer, filename) {
  const form = new FormData();
  form.append('file', buffer, filename);

  try {
    const res = await axios.post(
      `https://api.gofile.io/uploadFile?token=${gofileToken}`,
      form,
      { headers: form.getHeaders(), timeout: 15000 }
    );

    if (res.data.status !== 'ok') {
      console.error("Upload failed:", res.data);
      return null;
    }

    return res.data.data.downloadPage;
  } catch (err) {
    console.error("Gofile upload error:", err.message);
    return null;
  }
}

// Helper: Fetch from Wikipedia
async function getWikipediaData(query) {
  const searchApi = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json`;
  const pageApi = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;

  try {
    const [searchRes, pageRes] = await Promise.all([
      axios.get(searchApi),
      axios.get(pageApi).catch(() => null)
    ]);

    const sentence = pageRes?.data?.extract || 'No intro found.';
    const searchResults = (searchRes.data.query.search || []).slice(0, 10).map(item => ({
      title: item.title,
      snippet: item.snippet.replace(/<\/?[^>]+(>|$)/g, ""), // remove HTML
      pageId: item.pageid
    }));

    return { sentence, searchResults };
  } catch (err) {
    console.error('Wikipedia fetch error:', err.message);
    return { sentence: 'Wikipedia search failed.', searchResults: [] };
  }
}

// Helper: Get image URLs from DuckDuckGo
async function getImages(query) {
  try {
    const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`;
    const html = (await axios.get(url)).data;
    const $ = cheerio.load(html);

    const imgLinks = [];
    $('img').each((i, el) => {
      const src = $(el).attr('src') || '';
      if (src.startsWith('http')) imgLinks.push(src);
    });

    return imgLinks.slice(0, 20);
  } catch (err) {
    console.error('Image scraping failed:', err.message);
    return [];
  }
}

// POST /search
app.post('/search', async (req, res) => {
  const { query } = req.body;
  console.log('Received search query:', query);

  // 1. Get Wiki data
  const { sentence, searchResults } = await getWikipediaData(query);

  // 2. Get related images
  const imageLinks = await getImages(query);

  // 3. Build webResults FCards
  const webResults = [];
  const cardsHtml = [];

  for (let i = 0; i < searchResults.length; i++) {
    const item = searchResults[i];
    const content = `
      <h1>${item.title}</h1>
      <p>${item.snippet}</p>
      <a href="https://en.wikipedia.org/?curid=${item.pageId}" target="_blank">Read on Wikipedia</a>
    `;
    const buffer = Buffer.from(content, 'utf-8');
    const filename = `${item.title.replace(/\s+/g, '_')}.html`;
    const gofileUrl = await uploadToGofile(buffer, filename);

    if (gofileUrl) {
      webResults.push({
        title: item.title,
        snippet: item.snippet,
        url: gofileUrl
      });

      cardsHtml.push(`
        <div class="fcards">
          <img class="thumb" src="https://upload.wikimedia.org/wikipedia/commons/6/63/Wikipedia-logo.png" />
          <div class="fcards-content">
            <h4 class="fcards-title" onclick="copyToClipboard('${gofileUrl}')">${item.title}</h4>
            <div class="fcards-link" onclick="copyToClipboard('${gofileUrl}')">${gofileUrl}</div>
          </div>
        </div>
      `);
    }
  }

  res.json({
    sentence,
    web: webResults,
    images: imageLinks
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Fweb backend running on port ${PORT}`);
});
