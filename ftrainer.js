// ftrainer.js
import axios from "axios";

export async function runFTrainer(payload) {
  try {
    // Your Colab ngrok endpoint (this should run training + save model + return results)
    const colabUrl = "https://mindy-sinistrous-fortuitously.ngrok-free.dev/train";

    // Send training request
    const res = await axios.post(colabUrl, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 1000 * 60 * 10 // allow up to 10min for training response
    });

    const data = res.data;

    // Normalize response shape
    return {
      success: true,
      logs: data.logs || "No logs received",
      metrics: data.metrics || {},
      model_url: data.model_url || null,
    };
  } catch (err) {
    console.error("❌ Colab error:", err.message);
    return {
      success: false,
      error: "Failed to reach Colab",
      details: err.message,
    };
  }
}
