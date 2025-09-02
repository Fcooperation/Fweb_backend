// index.js
import express from "express";
import cors from "cors";
import { handleSearch } from "./fcrawler.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Root route
app.get("/", (req, res) => {
  res.send("Fweb backend is running 🚀");
});

// Search route → delegates to fcrawler.js
app.get("/search", (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: "No query provided" });
  }

  const results = handleSearch(query);
  res.json(results);
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
