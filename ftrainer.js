// ftrainer.js
import axios from "axios";

export async function runFTrainer(data) {
  try {
    console.log("📤 Forwarding training data to Colab...");

    // Replace this every time ngrok generates a new public URL
    const COLAB_URL = "https://mindy-sinistrous-fortuitously.ngrok-free.dev/";

    const response = await axios.post(COLAB_URL, data, {
      headers: { "Content-Type": "application/json" },
      timeout: 120000, // 2 minutes
    });

    console.log("📥 Response received from Colab:", response.data);
    return response.data;
  } catch (err) {
    console.error("❌ Error sending to Colab:", err.message);
    throw new Error(`Colab request failed: ${err.message}`);
  }
}
