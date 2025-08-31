const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
const PORT = 3000;

app.use(express.json());

// API endpoint to fetch and rebuild a site
app.post("/api/search", async (req, res) => {
  try {
    const { query } = req.body;

    // For now, treat the query as a full URL
    const response = await axios.get(query);
    const $ = cheerio.load(response.data);

    let blocks = [];

    $("body").children().each((i, el) => {
      blocks.push({
        tag: el.name,
        html: $.html(el)
      });
    });

    res.json({
      url: query,
      blocks
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Failed to fetch site" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
