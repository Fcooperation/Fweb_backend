import fetch from "node-fetch";
import FormData from "form-data";

export async function runFTrainer(payload) {
  // NGROK base for Colab
  const NGROK_BASE = "https://mindy-sinistrous-fortuitously.ngrok-free.dev";

  // Decide endpoint based on mode
  let endpoint = "/train";
  if (payload.mode === "pretrain") endpoint = "/pretrain";

  try {
    let res;

    if (payload.mode === "pretrain" && payload.modelBuffer) {
      // Use multipart/form-data for pretraining (file upload)
      const form = new FormData();
      form.append("file", Buffer.from(payload.modelBuffer.data), "model.zip"); // adjust filename if needed
      form.append("mode", "pretrain");

      res = await fetch(`${NGROK_BASE}${endpoint}`, {
        method: "POST",
        body: form
      });
    } else {
      // Normal JSON request for /train or /generate
      res = await fetch(`${NGROK_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    }

    const data = await res.json();
    return data;

  } catch (err) {
    console.error("❌ Error sending to Colab:", err.message);
    throw new Error("Failed to communicate with Colab");
  }
}
