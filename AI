import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 5000;

// Arli API key
const API_KEY = "9aa52f54-cad1-4200-9299-015926f1c3e6";

// Middleware
app.use(cors());
app.use(express.json());

// Queue mechanism
let isBusy = false;

// Function to call Arli with retries
async function askArli(prompt, retries = 5) {
  while (isBusy) {
    await new Promise(res => setTimeout(res, 2000));
  }
  isBusy = true;

  try {
    for (let attempt = 1; attempt <= retries; attempt++) {
      const response = await fetch("https://api.arliai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: "Qwen3-235B-A22B-Thinking-2507",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 200
        })
      });

      const data = await response.json();

      if (data.message?.includes("can only make 1 requests at a time")) {
        console.log(`Concurrency limit hit for prompt: "${prompt}", retrying in 2s (attempt ${attempt})...`);
        await new Promise(res => setTimeout(res, 2000));
      } else {
        return data.choices?.[0]?.message?.content || data;
      }
    }
    return { error: "Failed due to concurrency limit" };
  } catch (error) {
    console.error("Error calling Arli API:", error);
    return { error: error.message };
  } finally {
    isBusy = false;
  }
}

// API endpoint
app.post("/api/ask", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "No prompt provided" });

  const result = await askArli(prompt);
  res.json({ response: result });
});

// Start server
app.listen(PORT, () => {
  console.log(`Fweb backend running on port ${PORT}`);
});
