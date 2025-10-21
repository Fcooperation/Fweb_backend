import fetch from "node-fetch";

/**
 * runFTrainer - sends training data to Colab ngrok backend and streams live logs
 * @param {Array|Object} data - JSON data with {prompt, response} pairs
 * @param {Function} onLog - callback for live logs (receives string)
 * @returns {Promise<Object>} - resolves when training finishes
 */
export async function runFTrainer(data, onLog = (msg) => {}) {
  if (!data) throw new Error("No training data provided");

  try {
    const colabRes = await fetch(
      "https://mindy-sinistrous-fortuitously.ngrok-free.dev/train_stream",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }
    );

    if (!colabRes.ok) {
      throw new Error(`Colab server returned status ${colabRes.status}`);
    }

    // Node.js streaming
    colabRes.body.on("data", (chunk) => {
      const text = chunk.toString("utf-8");
      text.split("\n\n").forEach(line => {
        if (line.startsWith("data:")) {
          const msg = line.replace("data: ", "").trim();
          onLog(msg);
        }
      });
    });

    return new Promise((resolve, reject) => {
      colabRes.body.on("end", () => {
        // Training finished
        resolve({
          success: true,
          downloadUrl: "https://mindy-sinistrous-fortuitously.ngrok-free.dev/download_checkpoint"
        });
      });

      colabRes.body.on("error", (err) => {
        reject({ success: false, error: err.message });
      });
    });

  } catch (err) {
    console.error("❌ Error connecting to Colab SSE:", err);
    return { success: false, error: err.message };
  }
}
