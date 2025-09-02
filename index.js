// server.js
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Simple route
app.get("/", (req, res) => {
  res.send("Fweb backend is running 🚀");
});

// Search endpoint
app.get("/search", (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: "No query provided" });
  }

  // Check if query looks like a link
  const isLink = /^https?:\/\/|^[\w-]+\.[a-z]{2,}/i.test(query);

  if (isLink) {
    return res.json([
      {
        title: "Detected Link",
        url: query.startsWith("http") ? query : "https://" + query,
        snippet: "This search input looks like a website link."
      }
    ]);
  } else {
    return res.json([
      {
        title: "Detected Normal Search",
        url: "https://www.google.com/search?q=" + encodeURIComponent(query),
        snippet: "This search input looks like a normal search query."
      }
    ]);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
