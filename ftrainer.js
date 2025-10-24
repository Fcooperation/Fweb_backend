import fetch from "node-fetch";

const NGROK_BASE = "https://mindy-sinistrous-fortuitously.ngrok-free.dev";

// Main function to run training
export async function runFTrainer(payload) {
  // Determine endpoint
  let endpoint = "/train";
  if (payload.mode === "pretrain") endpoint = "/pretrain";

  try {
    // Send dataset to Colab
    const res = await fetch(`${NGROK_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    // --- Send logs separately to Colab ---
    if (payload.logs) {
      try {
        await fetch(`${NGROK_BASE}/logs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            round: payload.round,
            totalRounds: payload.totalRounds,
            modelSize: payload.modelSize,
            entries: payload.data?.length || 0,
            logs: payload.logs
          })
        });
      } catch (logErr) {
        console.error("❌ Failed to send logs to Colab:", logErr.message);
      }
    }

    return data;
  } catch (err) {
    console.error("❌ Error sending to Colab:", err.message);
    throw new Error("Failed to communicate with Colab");
  }
}
