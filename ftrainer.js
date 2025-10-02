// ftrainer.js
import axios from "axios";

export async function runFTrainer(payload) {
  try {
    // Example: call your Colab ngrok/endpoint
    const colabUrl = "https://YOUR-COLAB-NGROK-URL/run"; 
    const res = await axios.post(colabUrl, payload, {
      headers: { "Content-Type": "application/json" }
    });
    return res.data; // send colab response back to frontend
  } catch (err) {
    console.error("Colab error:", err.message);
    throw new Error("Failed to reach Colab");
  }
}
