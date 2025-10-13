import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import axios from "axios";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 🔗 Colab base URL
const COLAB_BASE = "https://mindy-sinistrous-fortuitously.ngrok-free.dev";

// 🧠 Forward training to Colab
app.post("/train", async (req, res) => {
  try {
    const { data, epochs } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ success: false, error: "Invalid data format" });
    }

    // Normalize for Colab
    const normalized = data.map(pair => ({
      prompt: pair.prompt || "",
      response: pair.response || ""
    }));

    console.log("🚀 Sending to Colab with epochs:", epochs);

    const result = await axios.post(`${COLAB_BASE}/train`, { data: normalized, epochs }, {
      headers: { "Content-Type": "application/json" },
      timeout: 1000 * 60 * 5 // 5 mins max
    });

    return res.json({ success: true, result: result.data });
  } catch (err) {
    console.error("❌ Train error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 🧩 Generate response from trained model
app.post("/generate", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: "Missing prompt" });

    console.log("🧠 Generating for:", prompt);
    const result = await axios.post(`${COLAB_BASE}/generate`, { prompt }, {
      headers: { "Content-Type": "application/json" },
      timeout: 1000 * 30
    });

    return res.json({ success: true, output: result.data.output || result.data });
  } catch (err) {
    console.error("❌ Generate error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 💾 Model download endpoint
app.get("/download-model", async (req, res) => {
  try {
    console.log("📦 Downloading model from Colab...");
    const fileRes = await axios.get(`${COLAB_BASE}/download-model`, {
      responseType: "arraybuffer"
    });

    res.setHeader("Content-Disposition", 'attachment; filename="ftrainer_model.zip"');
    res.setHeader("Content-Type", "application/zip");
    res.send(fileRes.data);
  } catch (err) {
    console.error("❌ Download error:", err.message);
    res.status(500).json({ success: false, error: "Failed to download model" });
  }
});

app.get("/", (req, res) => {
  res.send("✅ FTrainer backend is running fine!");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🔥 Server running on port ${PORT}`));
