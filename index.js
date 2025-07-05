// index.js

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const app = express();
const PORT = process.env.PORT || 3000;

// Gofile token (your real token should go here)
const GOFILE_TOKEN = 'e1LOiRxizCSLqTmyZ27AeZuN10qu0wfO';

app.use(cors());
app.use(express.json());

app.post('/search', async (req, res) => {
  const { query } = req.body;
  console.log('Received search query:', query);

  try {
    const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`;
    const html = await axios.get(wikiUrl).then(res => res.data);
    const $ = cheerio.load(html);

    // Extract summary sentence (first paragraph)
    const sentence = $('p').first().text().trim();

    // Extract 10 links
    const links = [];
    $('a[href^="/wiki/"]').each((_, el) => {
      const href = $(el).attr('href');
      const title = $(el).text().trim();
      if (title && links.length < 10 && !href.includes(':')) {
        links.push({
          title,
          url: `https://en.wikipedia.org${href}`,
          icon: 'https://en.wikipedia.org/static/favicon/wikipedia.ico',
        });
      }
    });

    // Extract 20 image URLs
    const images = [];
    $('img').each((_, el) => {
      let src = $(el).attr('src');
      if (src && !src.startsWith('http')) {
        src = 'https:' + src;
      }
      if (images.length < 20 && src) {
        images.push(src);
      }
    });

    // ✅ 1. Send results to frontend first
    res.json({
      sentence,
      web: links.map(link => ({
        title: link.title,
        url: `#`, // Placeholder; replaced after upload
        icon: link.icon,
      })),
      images,
      videos: [],
      books: [],
    });

    // 🕓 2. In background, build HTML content to save to Gofile
    const htmlContent = `
      <h2>${query} - Wikipedia Extract</h2>
      <p><strong>Summary:</strong> ${sentence}</p>
      <h3>Related Links</h3>
      <ul>
        ${links.map(l => `<li><a href="${l.url}">${l.title}</a></li>`).join('')}
      </ul>
      <h3>Images</h3>
      ${images.map(img => `<img src="${img}" width="100" style="margin:5px"/>`).join('')}
    `;

    const filePath = path.join(__dirname, `${query}.html`);
    fs.writeFileSync(filePath, htmlContent);

    // 3. Upload file to Gofile
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('token', GOFILE_TOKEN);

    const gofileRes = await axios.post('https://api.gofile.io/uploadFile', form, {
      headers: form.getHeaders(),
    });

    const gofileData = gofileRes.data;

    if (gofileData.status === 'ok') {
      const fileLink = gofileData.data.downloadPage;

      console.log(`✅ Uploaded to Gofile: ${fileLink}`);
    } else {
      console.error('Gofile upload error:', gofileData);
    }

    fs.unlinkSync(filePath); // clean up temp file
  } catch (err) {
    console.error('Error during Wikipedia crawl or upload:', err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Fweb backend listening on port ${PORT}`);
});
