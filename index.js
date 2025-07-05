const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const app = express();
const PORT = process.env.PORT || 3000;

// Replace with your real Gofile token
const GOFILE_TOKEN = 'e1LOiRxizCSLqTmyZ27AeZuN10qu0wfO';

app.use(cors());
app.use(express.json());

app.post('/search', async (req, res) => {
  const { query } = req.body;
  console.log('Received search query:', query);

  try {
    // 1. Fetch summary + page links
    const searchRes = await axios.get(`https://en.wikipedia.org/w/api.php`, {
      params: {
        action: 'query',
        list: 'search',
        srsearch: query,
        format: 'json',
        srlimit: 10,
      },
    });

    const searchResults = searchRes.data.query.search || [];

    // 2. Get the first page summary
    let sentence = '';
    if (searchResults.length) {
      const pageTitle = searchResults[0].title;
      const summaryRes = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`);
      sentence = summaryRes.data.extract || '';
    }

    // 3. Build 10 fcards (dummy Gofile links for now)
    const web = searchResults.map(r => ({
      title: r.title,
      url: '#', // Placeholder — actual link later from Gofile
      icon: 'https://en.wikipedia.org/static/favicon/wikipedia.ico',
    }));

    // 4. Fetch 20 related images using Wikimedia image search
    const imageRes = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        generator: 'images',
        titles: searchResults[0]?.title || query,
        prop: 'imageinfo',
        iiprop: 'url',
        format: 'json',
      },
    });

    let images = [];
    const pages = imageRes.data.query?.pages || {};
    for (let id in pages) {
      const img = pages[id].imageinfo?.[0]?.url;
      if (img && img.endsWith('.jpg') || img.endsWith('.png')) {
        images.push(img);
      }
    }

    images = images.slice(0, 20); // Limit to 20

    // ✅ 5. Respond to frontend first
    res.json({
      sentence,
      web,
      images,
      videos: [],
      books: [],
    });

    // 🕓 6. Build HTML content and upload to Gofile
    const htmlContent = `
      <h2>${query} - Wikipedia API Result</h2>
      <p><strong>Summary:</strong> ${sentence}</p>
      <h3>Related Pages</h3>
      <ul>
        ${web.map(w => `<li><img src="${w.icon}" width="16" /> ${w.title}</li>`).join('')}
      </ul>
      <h3>Images</h3>
      ${images.map(img => `<img src="${img}" width="100" style="margin:5px"/>`).join('')}
    `;

    const filePath = path.join(__dirname, `${query}.html`);
    fs.writeFileSync(filePath, htmlContent);

    // Upload to Gofile
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('token', GOFILE_TOKEN);

    const gofileRes = await axios.post('https://api.gofile.io/uploadFile', form, {
      headers: form.getHeaders(),
    });

    if (gofileRes.data.status === 'ok') {
      const gofileUrl = gofileRes.data.data.downloadPage;
      console.log(`✅ Gofile upload: ${gofileUrl}`);
    } else {
      console.error('Gofile upload failed:', gofileRes.data);
    }

    fs.unlinkSync(filePath); // Cleanup
  } catch (err) {
    console.error('API flow error:', err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Fweb backend listening on port ${PORT}`);
});
