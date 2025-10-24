import fetch from "node-fetch";

/**
 * runFTrainer
 * Handles training and generation requests
 * @param {Object} payload - JSON payload to send to your Flask backend
 *                         Must include `mode` ("train" or "generate")
 */
export async function runFTrainer(payload) {
  // Base URL of your Flask + ngrok backend
  const NGROK_BASE = "https://mindy-sinistrous-fortuitously.ngrok-free.dev";

  // Decide endpoint based on mode
  let endpoint = "/train";
  if (payload.mode === "generate") endpoint = "/generate";

  try {
    const res = await fetch(`${NGROK_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    // Return the response from Flask
    return data;

  } catch (err) {
    console.error("❌ Error sending to backend:", err.message);
    throw new Error("Failed to communicate with backend");
  }
}
