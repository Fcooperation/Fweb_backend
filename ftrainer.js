import fetch from "node-fetch";

export async function runFTrainer(payload) {
  // NGROK base for Colab
  const NGROK_BASE = "https://mindy-sinistrous-fortuitously.ngrok-free.dev";

  // Decide endpoint based on mode
  let endpoint = "/train";
  if (payload.mode === "pretrain") endpoint = "/pretrain";

  try {
    const res = await fetch(`${NGROK_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    // return whatever Colab responds
    return data;

  } catch (err) {
    console.error("❌ Error sending to Colab:", err.message);
    throw new Error("Failed to communicate with Colab");
  }
}
