// ftrainer.js
import axios from "axios";

export async function runFTrainer(payload) {
  try {
    const colabUrl = "https://mindy-sinistrous-fortuitously.ngrok-free.dev/train";

    // Always send JSON
    const headers = { "Content-Type": "application/json" };

    const res = await axios.post(colabUrl, payload, {
      headers,
      timeout: 1000 * 60 * 30, // 30 min timeout for large LLM training
    });

    const data = res.data;

    return {
      success: data.success ?? false,
      message: data.message || "No message received",
      logs: data.logs || "No logs received",
      metrics: data.metrics || {},
      model_url: data.model_url || null,
    };
  } catch (err) {
    console.error("❌ Colab error:", err.message);
    return {
      success: false,
      error: "Failed to reach Colab",
      details: err.response?.data || err.message,
    };
  }
}
