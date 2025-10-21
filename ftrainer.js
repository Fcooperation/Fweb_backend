import fetch from "node-fetch";

// ------------------------------
// Config
// ------------------------------
const COLAB_URL = "https://mindy-sinistrous-fortuitously.ngrok-free.dev";

/**
 * runFTrainer
 * @param {Object|Array} data - JSON object or array of {prompt, response} pairs
 * @param {function} onLog - callback function to receive live logs
 */
export async function runFTrainer(data, onLog = (msg) => {}) {
  if (!data) throw new Error("No training data provided");

  try {
    const colabRes = await fetch(`${COLAB_URL}/train_stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const reader = colabRes.body.getReader();
    const decoder = new TextDecoder("utf-8");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      // Colab SSE sends each message as "data: ..."
      chunk.split("\n\n").forEach(line => {
        if (line.startsWith("data:")) {
          const msg = line.replace("data: ", "").trim();
          onLog(msg); // send each log back via callback
        }
      });
    }

    // When training completes, return download URL
    const downloadUrl = `${COLAB_URL}/download_checkpoint`;
    return { success: true, downloadUrl };

  } catch (err) {
    console.error("Error connecting to Colab SSE:", err);
    return { success: false, error: err.message };
  }
}
