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

// Search route → async handler
app.get("/search", async (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: "No query provided" });
  }

  try {
    const results = await handleSearch(query); // ✅ await here
    res.json(results);
  } catch (err) {
    console.error("❌ Backend error:", err.message);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
