const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const gofileToken = 'e1LOiRxizCSLqTmyZ27AeZuN10qu0wfO';

app.use(cors());
app.use(express.json());

app.post('/search', async (req, res) => {
  const { query } = req.body;
  console.log('Received search query:', query);

  let summary = '';
  let fcards = [];
  let images = [];

  // Try to crawl Wikipedia page directly
  try {
    const wikiURL = `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`;
    const crawlRes = await axios.get(wikiURL);
    const $ = cheerio.load(crawlRes.data);

    // Get first paragraph
    summary = $('p').first().text().trim();

    // Get first 10 related links for fcards
    $('a').slice(0, 20).each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href && href.startsWith('/wiki/') && !href.includes(':')) {
        fcards.push({
          title: text || href.replace('/wiki/', ''),
          url: `https://en.wikipedia.org${href}`,
          icon: 'https://upload.wikimedia.org/wikipedia/commons/6/63/Wikipedia-logo.png'
        });
      }
    });

    // Get first 20 images
    $('img').slice(0, 20).each((i, el) => {
      const src = $(el).attr('src');
      if (src && !src.startsWith('data:')) {
        const url = src.startsWith('http') ? src : `https:${src}`;
        images.push(url);
      }
    });

  } catch (err) {
    console.log('Crawl failed, using Wikipedia API fallback');

    // Use API fallback
    const apiURL = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    const result = await axios.get(apiURL).then(r => r.data).catch(() => null);

    if (result) {
      summary = result.extract || '';
      fcards.push({
        title: result.title,
        url: result.content_urls.desktop.page,
        icon: result.thumbnail?.source || 'https://upload.wikimedia.org/wikipedia/commons/6/63/Wikipedia-logo.png'
      });

      // Get 20 images via media endpoint
      const mediaURL = `https://en.wikipedia.org/api/rest_v1/page/media/${encodeURIComponent(result.title)}`;
      const mediaRes = await axios.get(mediaURL).then(r => r.data).catch(() => null);
      if (mediaRes?.items) {
        images = mediaRes.items
          .filter(item => item.type === 'image')
          .slice(0, 20)
          .map(img => img.original?.source || img.src);
      }
    }
  }

  // Create temp HTML + TXT for upload
  const tempDir = './temp';
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

  const safeQuery = query.replace(/[^a-z0-9]/gi, '_');
  const txtPath = path.join(tempDir, `${safeQuery}.txt`);
  const htmlPath = path.join(tempDir, `${safeQuery}.html`);

  fs.writeFileSync(txtPath, summary || 'No summary found.');

  const htmlContent = `
    <html><body>
    <h2>${query} - Related Sites</h2>
    ${fcards.map(f => `
      <div style="margin: 10px 0; display: flex; align-items: center;">
        <img src="${f.icon}" style="width:32px; height:32px; margin-right:10px"/>
        <a href="${f.url}" target="_blank">${f.title}</a>
      </div>
    `).join('')}
    </body></html>
  `;
  fs.writeFileSync(htmlPath, htmlContent);

  // Upload to Gofile
  async function uploadToGofile(filePath) {
    const form = new FormData();
    form.append('token', gofileToken);
    form.append('file', fs.createReadStream(filePath));
    const uploadRes = await axios.post('https://api.gofile.io/uploadFile', form, {
      headers: form.getHeaders()
    });
    return uploadRes.data.data.downloadPage;
  }

  const [txtLink, htmlLink] = await Promise.all([
    uploadToGofile(txtPath),
    uploadToGofile(htmlPath)
  ]);

  // Replace fcard URLs with Gofile download
  fcards = fcards.slice(0, 10).map(f => ({
    title: f.title,
    icon: f.icon,
    link: htmlLink
  }));

  // Send result to frontend
  res.json({
    sentence: summary,
    web: fcards,
    images: images.slice(0, 20)
  });

  // Cleanup
  fs.unlinkSync(txtPath);
  fs.unlinkSync(htmlPath);
});

app.listen(PORT, () => {
  console.log(`Fweb backend listening on port ${PORT}`);
});
