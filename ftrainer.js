import axios from "axios";

export async function runFTrainer(payload) {
  try {
    const colabUrl = "https://mindy-sinistrous-fortuitously.ngrok-free.dev/train";

    // Auto-normalize if user sends q/a instead of instruction/response
    const normalized = {
      data: (payload.data || []).map(pair => ({
        instruction: pair.q || pair.instruction,
        response: pair.a || pair.response
      }))
    };

    const res = await axios.post(colabUrl, normalized, {
      headers: { "Content-Type": "application/json" },
      timeout: 1000 * 60, // 1 min timeout
    });

    return res.data;
  } catch (err) {
    console.error("❌ Colab error:", err.message);
    return { success: false, error: "Failed to reach Colab", details: err.message };
  }
}
