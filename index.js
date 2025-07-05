import express from 'express';
import fetch from 'node-fetch';
import FormData from 'form-data';

const app = express();
app.use(express.json());

const GOFILE_TOKEN = 'e1LOiRxizCSLqTmyZ27AeZuN10qu0wfO';

// Search Wikipedia API helper - returns basic search results (title, snippet, url)
async function searchWikipedia(query) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(query)}&utf8=1&origin=*`;
  const res = await fetch(url);
  const data = await res.json();

  if (!data.query || !data.query.search) return [];

  return data.query.search.map(item => ({
    pageid: item.pageid,
    title: item.title,
    snippet: item.snippet.replace(/<\/?[^>]+(>|$)/g, ""), // strip HTML tags
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`
  }));
}

// Fetch extract (summary) and main image for a page by pageid
async function fetchPageDetails(pageid) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|pageimages&pageids=${pageid}&explaintext=1&exintro=1&pithumbsize=200&origin=*`;
  const res = await fetch(url);
  const data = await res.json();

  if (!data.query || !data.query.pages || !data.query.pages[pageid]) return {};

  const page = data.query.pages[pageid];
  return {
    extract: page.extract || '',
    thumbnail: page.thumbnail ? page.thumbnail.source : null
  };
}

// Upload JSON to Gofile
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

app.post('/search', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return res.status(400).json({ error: 'Missing or invalid query' });
    }

    // Search Wikipedia
    const results = await searchWikipedia(query.trim());

    // For each search result, fetch extract and thumbnail image
    const detailedResults = await Promise.all(results.map(async (item) => {
      const details = await fetchPageDetails(item.pageid);
      return {
        title: item.title,
        snippet: item.snippet,
        url: item.url,
        extract: details.extract,
        thumbnail: details.thumbnail
      };
    }));

    // Upload detailed results to Gofile
    let gofileLink = null;
    try {
      gofileLink = await uploadToGofile(detailedResults, `search_${Date.now()}.json`);
    } catch (uploadErr) {
      console.error('Gofile upload error:', uploadErr);
    }

    // Respond with detailed results and gofile link
    res.json({ web: detailedResults, gofileLink });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Fweb backend listening on port ${PORT}`);
});
