
// index.js
import express from 'express';
import fetch from 'node-fetch'; // or native fetch if Node >= 18
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.post('/search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'No query provided' });

  try {
    // Example: search using DuckDuckGo and get HTML
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl);
    const html = await response.text();

    // Return the raw HTML
    res.json({ html });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Fweb backend running on port ${PORT}`));
