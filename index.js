const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

async function fetchFromWikipedia(query) {
  try {
    // Summary extract
    const summaryRes = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
    const summaryText = summaryRes?.data?.extract || "No summary found.";

    // Search results
    const searchRes = await axios.get(`https://en.wikipedia.org/w/api.php`, {
      params: {
        action: 'query',
        list: 'search',
        srsearch: query,
        format: 'json',
        origin: '*'
      }
    });

    const searchResults = searchRes.data?.query?.search || [];

    const web = searchResults.slice(0, 10).map(result => ({
      title: result.title,
      snippet: result.snippet.replace(/<\/?[^>]+(>|$)/g, ""),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(result.title)}`
    }));

    // Image results
    const imageRes = await axios.get(`https://en.wikipedia.org/w/api.php`, {
      params: {
        action: 'query',
        prop: 'images',
        titles: query,
        format: 'json',
        origin: '*'
      }
    });

    const pages = imageRes?.data?.query?.pages || {};
    const images = [];

    for (const page of Object.values(pages)) {
      if (page.images) {
        for (const img of page.images) {
          const filename = img.title.replace('File:', '');
          if (/\.(jpg|jpeg|png|gif)$/i.test(filename)) {
            images.push(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}`);
            if (images.length >= 20) break;
          }
        }
      }
      if (images.length >= 20) break;
    }

    return {
      sentence: summaryText,
      web,
      images
    };

  } catch (err) {
    console.error("API error:", err.message);
    return {
      sentence: "Not found",
      web: [],
      images: []
    };
  }
}

app.post('/search', async (req, res) => {
  const { query } = req.body;
  console.log("Received search query:", query);

  const result = await fetchFromWikipedia(query);
  res.json(result); // ✅ structured correctly
});

app.listen(PORT, () => {
  console.log(`Fweb backend listening on port ${PORT}`);
});
