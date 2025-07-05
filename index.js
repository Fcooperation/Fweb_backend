const express = require('express');
const cors = require('cors');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { default: fetch } = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

// Replace with your actual Gofile token
const gofileToken = 'e1LOiRxizCSLqTmyZ27AeZuN10qu0wfO';

app.post('/search', async (req, res) => {
  const { query } = req.body;
  console.log('Received search query:', query);

  let sentence = 'Not found';
  let web = [];
  let images = [];

  try {
    // Step 1: Get Wikipedia search results
    const searchRes = await axios.get(`https://en.wikipedia.org/w/api.php`, {
      params: {
        action: 'query',
        list: 'search',
        srsearch: query,
        format: 'json',
        origin: '*'
      }
    });

    const results = searchRes.data?.query?.search || [];
    const pageTitle = results[0]?.title;

    if (!pageTitle) {
      return res.json({ sentence: "Not found", web: [], images: [] });
    }

    // Step 2: Get page summary
    try {
      const summaryRes = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`);
      sentence = summaryRes.data.extract || 'Not found';
    } catch (e) {
      sentence = 'Not found';
    }

    // Step 3: Build fcards from top 10 pages
    web = results.slice(0, 10).map(item => ({
      title: item.title,
      snippet: item.snippet.replace(/<\/?[^>]+(>|$)/g, ''),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title)}`,
      gofile: 'pending',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/6/63/Wikipedia-logo.png'
    }));

    // Step 4: Get images from Commons API
    const imageRes = await axios.get(`https://en.wikipedia.org/w/api.php`, {
      params: {
        action: 'query',
        generator: 'images',
        prop: 'imageinfo',
        gimlimit: '20',
        iiprop: 'url',
        titles: pageTitle,
        format: 'json',
        origin: '*'
      }
    });

    const pages = imageRes.data?.query?.pages || {};
    images = Object.values(pages)
      .map(p => p.imageinfo?.[0]?.url)
      .filter(Boolean)
      .slice(0, 20);

    // Step 5: Send result to frontend first
    res.json({ sentence, web, images });

    // Step 6: Upload to Gofile (in background)
    for (const item of web) {
      try {
        const content = `${item.title}\n${item.snippet}\n${item.url}`;
        const filePath = path.join(__dirname, 'temp.txt');
        fs.writeFileSync(filePath, content);

        const form = new FormData();
        form.append('file', fs.createReadStream(filePath));

        const uploadRes = await axios.post(`https://api.gofile.io/uploadFile`, form, {
          headers: form.getHeaders(),
          params: { token: gofileToken }
        });

        const gofileUrl = uploadRes.data?.data?.downloadPage || 'error';
        item.gofile = gofileUrl;

        fs.unlinkSync(filePath);
      } catch (e) {
        console.log('Gofile upload error:', e.message);
      }
    }

  } catch (err) {
    console.log('API flow error:', err.message);
    res.json({ sentence: 'Not found', web: [], images: [] });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Fweb backend listening on port ${PORT}`);
});
