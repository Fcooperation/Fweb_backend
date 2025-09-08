import express from "express";
import cors from "cors";
import { handleSearch } from "./fcrawler.js";
import { login } from "./faccount.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ------------------------------
// Logging middleware
// ------------------------------
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// ------------------------------
// Routes
// ------------------------------

// Health check
app.get("/health", (req, res) => res.status(200).send("ok"));

// Root
app.get("/", (req, res) => res.send("Fweb backend is running 🚀"));

// Search
app.get("/search", async (req, res) => {
  console.log(`🔍 Search requested: ${req.query.q}`);
  if (!req.query.q) return res.status(400).json({ error: "No query provided" });

  try {
    const results = await handleSearch(req.query.q);
    res.json(results);
  } catch (err) {
    console.error("❌ Backend error:", err.message);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

// Login
app.post("/login", async (req, res) => {
  console.log(`🔑 Login attempt: ${req.body.email}`);
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });

  try {
    const user = await login({ email, password });
    res.json({ success: true, user });
  } catch (err) {
    console.error("❌ Login error:", err.message);
    res.status(401).json({ error: err.message });
  }
});

// ------------------------------
// Global Error Handlers
// ------------------------------
process.on("unhandledRejection", (err) => console.error("❌ Unhandled Rejection:", err));
process.on("uncaughtException", (err) => console.error("❌ Uncaught Exception:", err));

// ------------------------------
// Start Server
// ------------------------------
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
