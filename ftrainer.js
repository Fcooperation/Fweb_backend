// ftrainer.js
import axios from "axios";

export async function runFTrainer(payload) {
  try {
    const colabUrl = "https://mindy-sinistrous-fortuitously.ngrok-free.dev/train";

    const res = await axios.post(colabUrl, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 1000 * 60, // 1 min timeout for testing
    });

    return res.data; // whatever Colab responds
  } catch (err) {
    console.error("❌ Colab error:", err.message);
    return { success: false, error: "Failed to reach Colab", details: err.message };
  }
}
