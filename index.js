const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const GOFILE_TOKEN = 'e1LOiRxizCSLqTmyZ27AeZuN10qu0wfO';

app.post('/search', async (req, res) => {
  const { query } = req.body;
  console.log('Received search query:', query);

  const result = {
    sentence: '',
    web: [],
    images: []
  };

  try {
    // 1. Get summary for sentenceCrawl
    const summaryRes = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
    result.sentence = summaryRes.data.extract || '';

    // 2. Get search results
    const searchRes = await axios.get(`https://en.wikipedia.org/w/api.php`, {
      params: {
        action: 'query',
        list: 'search',
        srsearch: query,
        format: 'json',
        srlimit: 10
      }
    });

    const searchResults = searchRes.data.query.search || [];
    result.web = searchResults.map(item => ({
      title: item.title,
      snippet: item.snippet.replace(/<\/?[^>]+(>|$)/g, ""),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title)}`
    }));

    // 3. Get related images from Wikimedia
    const imageRes = await axios.get(`https://en.wikipedia.org/w/api.php`, {
      params: {
        action: 'query',
        prop: 'pageimages',
        format: 'json',
        piprop: 'thumbnail',
        pithumbsize: 300,
        generator: 'search',
        gsrlimit: 20,
        gsrsearch: query
      }
    });

    const pages = imageRes.data.query?.pages || {};
    result.images = Object.values(pages)
      .map(p => p.thumbnail?.source)
      .filter(Boolean)
      .slice(0, 20);

    // === ✅ Feed users FIRST ===
    res.json(result);

    // === Then silently save to Gofile ===
    const textContent = `
Query: ${query}
Sentence: ${result.sentence}
Links:
${result.web.map(r => `${r.title} - ${r.url}`).join('\n')}
`;

    const filePath = path.join(__dirname, `${Date.now()}-${query}.txt`);
    fs.writeFileSync(filePath, textContent, 'utf8');

    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('token', GOFILE_TOKEN);

    try {
      const gofileUpload = await axios.post('https://api.gofile.io/uploadFile', form, {
        headers: form.getHeaders()
      });
      console.log('Gofile upload success:', gofileUpload.data?.data?.downloadPage);
    } catch (gofileErr) {
      console.log('Gofile upload error:', gofileErr.response?.statusText || gofileErr.message);
    }

    fs.unlink(filePath, () => {});
  } catch (err) {
    console.error('API flow error:', err.response?.statusText || err.message);
    return res.json({ sentence: 'Not found', web: [], images: [] });
  }
});

app.listen(PORT, () => {
  console.log(`Fweb backend listening on port ${PORT}`);
});
