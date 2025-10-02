// ftrainer.js
import axios from "axios";
import FormData from "form-data"; // important in Node.js

export async function runFTrainer(payload) {
  try {
    const colabUrl = "https://mindy-sinistrous-fortuitously.ngrok-free.dev/train";

    let dataToSend, headers;

    if (payload instanceof FormData) {
      dataToSend = payload;
      headers = payload.getHeaders(); // <-- tells axios it's multipart/form-data
    } else {
      dataToSend = payload;
      headers = { "Content-Type": "application/json" };
    }

    const res = await axios.post(colabUrl, dataToSend, {
      headers,
      timeout: 1000 * 60 * 10, // 10 min
    });

    const data = res.data;

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
