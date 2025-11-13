import express from "express";
import cors from "cors";
import { handleSearch } from "./fcrawler.js";
import { login } from "./faccount.js";
import { fetchImages } from "./fimages.js"; // new
import { fetchVideos } from "./fvids.js";   // new
import { fetchFAI } from "./fai.js";
import { runFTrainer } from "./ftrainer.js";
import { loadChatUserQuery } from "./fchataccount.js";
import { sendMessageQuery, detectIncomingQuery } from "./fchatmessage.js";
import { deleteMessageQuery } from "./fchatlogs.js";
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ------------------------------
// Logging middleware
// ------------------------------
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[INCOMING] ${req.method} ${req.url}`);

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} ${duration}ms`
    );
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

// Normal Search
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

// ------------------------------
// Images search route
// ------------------------------
app.get("/fimages", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "No query provided" });

  try {
    const images = await fetchImages(query);
    res.json(images);
  } catch (err) {
    console.error("❌ Images fetch error:", err.message);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

// ------------------------------
// Videos search route
// ------------------------------
app.get("/fvids", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "No query provided" });

  try {
    const videos = await fetchVideos(query);
    res.json(videos);
  } catch (err) {
    console.error("❌ Videos fetch error:", err.message);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

// ------------------------------
// Login
// ------------------------------
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
// Global error handlers
// ------------------------------
process.on("unhandledRejection", (err) => console.error("❌ Unhandled Rejection:", err));
process.on("uncaughtException", (err) => console.error("❌ Uncaught Exception:", err));
// ------------------------------
// FAI Search route
// ------------------------------
app.get("/fai", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "No query provided" });

  try {
    // fetchFAI returns structured { answer, links: [...] }
    const faiResults = await fetchFAI(query);
    res.json(faiResults);
  } catch (err) {
    console.error("❌ FAI error:", err.message);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});
// ------------------------------
// Training route
// ------------------------------
app.post("/train", async (req, res) => {
  console.log("⚡ Training request received:", req.body);

  try {
    const result = await runFTrainer(req.body); // call ftrainer
    res.json({ success: true, result });
  } catch (err) {
    console.error("❌ Training error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

import multer from "multer";
const upload = multer({ storage: multer.memoryStorage() }); // in-memory upload

// ------------------------------
// Pretrain route
// ------------------------------
app.post("/pretrain", upload.single("model_file"), async (req, res) => {
  console.log("⚡ Pretraining request received");

  if (!req.file) {
    return res.status(400).json({ success: false, error: "No model file uploaded" });
  }

  // Optional: training cycles from formData
  const cycles = parseInt(req.body.cycles) || 1;

  try {
    // Call runFTrainer with 'pretrain' mode
    const result = await runFTrainer({
      mode: "pretrain",        // signal to ftrainer.js this is a pretrain
      modelBuffer: req.file.buffer,
      filename: req.file.originalname,
      cycles
    });

    res.json({ success: true, result });
    console.log(`✅ Pretraining started for ${req.file.originalname}`);
  } catch (err) {
    console.error("❌ Pretraining error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
// ------------------------------
// Logs route
// ------------------------------
app.post("/logs", async (req, res) => {
  const { round, totalRounds, modelSize, entries, logs: logData } = req.body;

  if (!logData) return res.status(400).json({ success: false, error: "No logs provided" });

  try {
    console.log(`📝 Logs received for round ${round || "-"} (${totalRounds || "-"})`);
    console.log(`Model Size: ${modelSize || "unknown"}, Entries: ${entries || 0}`);
    console.log("------ LOG START ------");
    console.log(logData);
    console.log("------- LOG END -------");

    // Optional: You could also save to a file here if needed

    res.json({ success: true, message: "Logs recorded" });
  } catch (err) {
    console.error("❌ Logs error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

//load loadChatUserQuery
app.get("/chatuser/:id", async (req, res) => {
  const chatUserId = req.params.id;
  try {
    const user = await loadChatUserQuery(chatUserId); // query Supabase safely
    res.json({ success: true, user });
  } catch (err) {
    console.error("❌ loadChatUser error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

//send messages
app.post("/sendmessage", async (req, res) => {
  const { recipientId, messageData } = req.body;
  if (!recipientId || !messageData) return res.status(400).json({ error: "Missing fields" });

  try {
    const result = await sendMessageQuery(recipientId, messageData);
    res.json({ success: true, result });
  } catch (err) {
    console.error("❌ sendMessage error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

//receive messages
app.get("/detectmessages/:id", async (req, res) => {
  const chatUserId = req.params.id; // current user id in this case
  try {
    const messages = await detectIncomingQuery(chatUserId);
    res.json({ success: true, messages });
  } catch (err) {
    console.error("❌ detectIncoming error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

//Fchat Logs
app.post("/deletemessage", async (req, res) => {
  const { messageId } = req.body;
  if (!messageId) return res.status(400).json({ error: "Missing messageId" });

  try {
    const result = await deleteMessageQuery(messageId);
    res.json({ success: true, result });
  } catch (err) {
    console.error("❌ deleteMessage error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ------------------------------
// Start Server
// ------------------------------
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));