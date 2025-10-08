import axios from "axios";

export async function runFTrainer(payload) {
  try {
    const colabUrl = "https://mindy-sinistrous-fortuitously.ngrok-free.dev/train";

    // Convert frontend format to Colab format: array of {prompt, response}
    const normalized = payload.data.map(pair => ({
      prompt: pair.prompt || pair.instruction || "",
      response: pair.response || pair.a || ""
    }));

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
