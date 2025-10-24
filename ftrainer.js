import fs from "fs";
import fetch from "node-fetch";
import FormData from "form-data";

const NGROK_BASE = "https://mindy-sinistrous-fortuitously.ngrok-free.dev";

export async function runFTrainer(filePath) {
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath));
  form.append("mode", "pretrain"); // optional if you need mode info

  try {
    const res = await fetch(`${NGROK_BASE}/pretrain`, {
      method: "POST",
      body: form
    });

    const data = await res.json();
    console.log("Response from server:", data);
    return data;

  } catch (err) {
    console.error("❌ Error sending to Colab:", err.message);
    throw new Error("Failed to communicate with Colab");
  }
}
