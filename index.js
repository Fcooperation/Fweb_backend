const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Helper to fetch from Wikipedia API
async function fetchFromWikipedia(query) {
  try {
    const summaryRes = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
    const summaryText = summaryRes.data.extract || "No summary found.";

    const searchRes = await axios.get(`https://en.wikipedia.org/w/api.php`, {
      params: {
        action: 'query',
        list: 'search',
        srsearch: query,
        format: 'json',
        origin: '*'
      }
    });

    const searchResults = searchRes.data.query?.search || [];

    const web = searchResults.slice(0, 10).map(result => ({
      title: result.title,
      snippet: result.snippet.replace(/<\/?[^>]+(>|$)/g, ""), // remove HTML tags
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(result.title)}`
    }));

    const imagesRes = await axios.get(`https://en.wikipedia.org/w/api.php`, {
      params: {
        action: 'query',
        prop: 'images',
        titles: query,
        format: 'json',
        origin: '*'
      }
    });

    // Extract images (limit 20)
    const pages = imagesRes.data.query?.pages || {};
    const images = [];
    for (const page of Object.values(pages)) {
      if (page.images) {
        for (const img of page.images) {
          if (img.title && /\.(jpg|jpeg|png|gif)$/i.test(img.title)) {
            const imageTitle = img.title.replace('File:', '');
            images.push(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageTitle)}`);
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
    console.error("API flow error:", err.message);
    return {
      sentence: "Not found",
      web: [],
      images: []
    };
  }
}

// POST /search
app.post('/search', async (req, res) => {
  const { query } = req.body;
  console.log("Received search query:", query);

  const results = await fetchFromWikipedia(query);
  res.json(results); // Send to frontend directly
});

// Start server
app.listen(PORT, () => {
  console.log(`Fweb backend listening on port ${PORT}`);
});
