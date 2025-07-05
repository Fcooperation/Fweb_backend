const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const gofileToken = "e1LOiRxizCSLqTmyZ27AeZuN10qu0wfO";

app.use(cors());
app.use(express.json());

async function uploadToGofile(buffer, filename) {
  const form = new FormData();
  form.append('file', buffer, filename);
  form.append('token', gofileToken);

  try {
    const res = await axios.post('https://api.gofile.io/uploadFile', form, {
      headers: form.getHeaders(),
      timeout: 15000,
    });
    return res.data.data.downloadPage;
  } catch (err) {
    console.error("Gofile upload error:", err.message);
    return null;
  }
}

async function crawlWikipedia(query) {
  const searchUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`;
  try {
    const res = await axios.get(searchUrl, { timeout: 10000 });
    const $ = cheerio.load(res.data);

    const paragraph = $('#mw-content-text p').first().text().trim();
    const links = [];
    $('#mw-content-text a[href^="/wiki/"]').each((i, el) => {
      const title = $(el).attr('title');
      const href = $(el).attr('href');
      if (title && links.length < 10) {
        links.push({
          title,
          icon: 'https://upload.wikimedia.org/wikipedia/commons/6/63/Wikipedia-logo.png',
          url: `https://en.wikipedia.org${href}`
        });
      }
    });

    const images = [];
    $('img').each((i, el) => {
      const src = $(el).attr('src');
      if (src && images.length < 20 && !src.includes('logo')) {
        images.push(`https:${src}`);
      }
    });

    return { paragraph, links, images };
  } catch (err) {
    console.warn("Crawl failed, switching to API...");
    return null;
  }
}

async function searchWikipediaAPI(query) {
  try {
    const res = await axios.get(`https://en.wikipedia.org/w/api.php`, {
      params: {
        action: 'query',
        list: 'search',
        srsearch: query,
        format: 'json'
      }
    });

    const summaryRes = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
    const paragraph = summaryRes.data.extract;

    const links = res.data.query.search.slice(0, 10).map(item => ({
      title: item.title,
      icon: 'https://upload.wikimedia.org/wikipedia/commons/6/63/Wikipedia-logo.png',
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title)}`
    }));

    return { paragraph, links, images: [] };
  } catch (e) {
    console.error("Wikipedia API failed:", e.message);
    return null;
  }
}

app.post('/search', async (req, res) => {
  const { query } = req.body;
  console.log("Received search query:", query);

  let data = await crawlWikipedia(query);
  if (!data) data = await searchWikipediaAPI(query);
  if (!data) return res.json({ web: [], images: [], sentence: '' });

  // Save to Gofile (html page of links)
  const htmlContent = `
    <h2>Search: ${query}</h2>
    <p>${data.paragraph}</p>
    <ul>
      ${data.links.map(l => `<li><a href="${l.url}" target="_blank">${l.title}</a></li>`).join('')}
    </ul>
  `;
  const buffer = Buffer.from(htmlContent, 'utf-8');
  const savedUrl = await uploadToGofile(buffer, `${query}_fweb.html`);

  // Replace original links with gofile download page link
  const web = data.links.map(l => ({
    title: l.title,
    icon: l.icon,
    url: savedUrl
  }));

  res.json({
    sentence: data.paragraph,
    web,
    images: data.images
  });
});

app.listen(PORT, () => {
  console.log(`Fweb backend running on port ${PORT}`);
});
