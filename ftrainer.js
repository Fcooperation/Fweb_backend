// ftrainer.js
import axios from "axios";

export async function runFTrainer(data) {
  try {
    console.log("📤 Forwarding training data to Colab...");

    // ✅ Use your current ngrok link + correct route
    const COLAB_URL = "https://mindy-sinistrous-fortuitously.ngrok-free.dev/train";

    const response = await axios.post(COLAB_URL, data, {
      headers: { "Content-Type": "application/json" },
      timeout: 60000, // 1 minute for now
    });

    console.log("📥 Response received from Colab:", response.data);
    return response.data;
  } catch (err) {
    console.error("❌ Error sending to Colab:", err.message);
    throw new Error(`Colab request failed: ${err.message}`);
  }
}
