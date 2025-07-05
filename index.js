import express from 'express';
import fetch from 'node-fetch';
import FormData from 'form-data';

const app = express();
app.use(express.json());

const GOFILE_TOKEN = 'e1LOiRxizCSLqTmyZ27AeZuN10qu0wfO'; // Your token

// Search Wikipedia API helper
async function searchWikipedia(query) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(query)}&utf8=1&origin=*`;
  const res = await fetch(url);
  const data = await res.json();

  if (!data.query || !data.query.search) return [];

  // Map search results
  return data.query.search.map(item => ({
    title: item.title,
    snippet: item.snippet.replace(/<\/?[^>]+(>|$)/g, ""), // strip HTML tags
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`
  }));
}

// Upload JSON to Gofile
async function uploadToGofile(content, filename = 'search_result.json') {
  // Step 1: Create an upload session
  const createSessionRes = await fetch(`https://api.gofile.io/createAccount?token=${GOFILE_TOKEN}`);
  // Gofile docs don't explicitly say createAccount is necessary here,
  // but assuming you have an account with token ready.

  // Step 2: Upload file to Gofile
  const form = new FormData();
  form.append('token', GOFILE_TOKEN);
  form.append('file', Buffer.from(JSON.stringify(content)), filename);

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

app.post('/search', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Missing query' });

    // Search Wikipedia
    const results = await searchWikipedia(query);

    // Upload to Gofile
    let gofileLink = null;
    try {
      gofileLink = await uploadToGofile(results, `search_${Date.now()}.json`);
    } catch (uploadErr) {
      console.error('Gofile upload error:', uploadErr);
    }

    // Respond with results and optionally gofile link
    res.json({ web: results, gofileLink });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Fweb backend listening on port ${PORT}`);
});
