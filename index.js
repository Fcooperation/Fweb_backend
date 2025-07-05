import express from 'express';
import fetch from 'node-fetch';
import FormData from 'form-data';

const app = express();
app.use(express.json());

// Your Gofile token
const GOFILE_TOKEN = 'e1LOiRxizCSLqTmyZ27AeZuN10qu0wfO';

// 🧠 Wikipedia Search
async function searchWikipedia(query) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(query)}&utf8=1&origin=*`;
  const res = await fetch(url);
  const data = await res.json();

  if (!data.query || !data.query.search) return [];

  return data.query.search.map(item => ({
    title: item.title,
    snippet: item.snippet.replace(/<\/?[^>]+(>|$)/g, ""), // Strip HTML tags
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`
  }));
}

// 📤 Upload to Gofile
async function uploadToGofile(content, filename = 'search_result.json') {
  const form = new FormData();
  form.append('token', GOFILE_TOKEN);
  form.append('file', Buffer.from(JSON.stringify(content, null, 2)), filename);

  const uploadRes = await fetch('https://api.gofile.io/uploadFile', {
    method: 'POST',
    body: form
  });

  const uploadData = await uploadRes.json();
  if (uploadData.status === 'ok') {
    return uploadData.data.downloadPage;
  } else {
    throw new Error('Upload failed: ' + JSON.stringify(uploadData));
  }
}

// 📥 POST /search route
app.post('/search', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Missing query' });

    const results = await searchWikipedia(query);

    let gofileLink = null;
    try {
      gofileLink = await uploadToGofile(results, `search_${Date.now()}.json`);
    } catch (uploadErr) {
      console.error('Gofile upload error:', uploadErr.message);
    }

    res.json({ web: results, gofileLink });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ OPEN PORT 10000
const PORT = 10000;
app.listen(PORT, () => {
  console.log(`✅ Fweb backend running on http://localhost:${PORT}`);
});
