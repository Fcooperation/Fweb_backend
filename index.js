const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
app.use(express.json());

app.post("/search", async (req, res) => {
  const query = req.body.query;
  console.log(`🔎 Reading search: "${query}"`);

  const pageTitle = query.split(" ").slice(-1)[0].toLowerCase(); // fallback guess
  const wikiTitle = query.replace(/\s+/g, "_");
  const url = `https://en.wikipedia.org/wiki/${wikiTitle}`;

  try {
    console.log(`📄 Crawling Wikipedia for: "${wikiTitle}"`);
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const paragraphs = $("p")
      .map((i, el) => $(el).text().trim())
      .get()
      .filter((txt) => txt.length > 50);

    const match = paragraphs.find((p) =>
      p.toLowerCase().includes(query.toLowerCase())
    );

    const mainAnswer = match || paragraphs[0] || "No matching content found.";

    const related = paragraphs
      .filter((p) => p !== mainAnswer)
      .slice(0, 5);

    res.json({
      response: mainAnswer,
      related,
      source: url,
      title: `Wikipedia: ${wikiTitle}`
    });
  } catch (err) {
    console.log(`❌ Wikipedia crawl error for "${query}": ${err.message}`);
    res.json({
      response: "❌ No result found.",
      related: [],
      source: null
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ fAi backend running on port ${PORT}`));
