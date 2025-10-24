import fs from "fs";
import fetch from "node-fetch";
import FormData from "form-data";

const NGROK_BASE = "https://mindy-sinistrous-fortuitously.ngrok-free.dev";

export async function runFTrainer(filePath) {
  const endpoint = "/pretrain";

  // Read .pt file
  const fileBuffer = fs.readFileSync(filePath);

  const form = new FormData();
  form.append("file", fileBuffer, "model.pt");
  form.append("mode", "pretrain");

  try {
    const res = await fetch(`${NGROK_BASE}${endpoint}`, {
      method: "POST",
      body: form
    });

    const data = await res.json();
    return data;

  } catch (err) {
    console.error("❌ Error sending to Colab:", err.message);
    throw new Error("Failed to communicate with Colab");
  }
}

// Usage example
// await runFTrainer("./path/to/model.pt");
