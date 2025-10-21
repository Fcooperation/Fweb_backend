import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// ------------------------------
// Config
// ------------------------------
const COLAB_URL = "https://mindy-sinistrous-fortuitously.ngrok-free.dev";

// ------------------------------
// SSE training endpoint
// ------------------------------
app.post("/train", async (req, res) => {
  const data = req.body;
  if (!data) return res.status(400).json({ error: "No data provided" });

  // set headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders();

  try {
    // send POST request to Colab SSE endpoint
    const colabRes = await fetch(`${COLAB_URL}/train_stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const reader = colabRes.body.getReader();
    const decoder = new TextDecoder("utf-8");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      // Colab SSE sends each message as "data: ..."
      chunk.split("\n\n").forEach(line => {
        if (line.startsWith("data:")) {
          res.write(line + "\n\n");
        }
      });
    }

    res.end();
  } catch (err) {
    console.error("Error connecting to Colab SSE:", err);
    res.write(`data: ERROR: ${err.message}\n\n`);
    res.end();
  }
});

// ------------------------------
// Download trained model
// ------------------------------
app.get("/download_checkpoint", (req, res) => {
  res.redirect(`${COLAB_URL}/download_checkpoint`);
});

// ------------------------------
// Start backend server
// ------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ FTrainer backend running on port ${PORT}`));
