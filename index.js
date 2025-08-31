import express from "express";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const app = express();
app.use(express.json());

app.post("/api/ask", async (req, res) => {
  try {
    const { query } = req.body;

    // If the user typed "ebsu.edu.ng", make sure it has https://
    let url = query.startsWith("http") ? query : `https://${query}`;

    // Fetch the raw HTML
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(500).json({ error: "Failed to fetch site" });
    }
    const html = await response.text();

    // Use cheerio to extract in block format
    const $ = cheerio.load(html);
    let blocks = [];

    $("h1, h2, h3, p, img, a, ul, ol, li").each((i, el) => {
      const tag = el.tagName;
      if (tag === "img") {
        blocks.push(`<img src="${$(el).attr("src")}" alt=""/>`);
      } else if (tag === "a") {
        blocks.push(`<a href="${$(el).attr("href")}">${$(el).text()}</a>`);
      } else {
        blocks.push(`<${tag}>${$(el).text()}</${tag}>`);
      }
    });

    res.json({
      url,
      content: blocks.join("\n")
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
