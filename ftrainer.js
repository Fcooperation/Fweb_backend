// ftrainer.js
import axios from "axios";

/**
 * Run FTrainer
 * @param {Object} options
 * @param {Array} options.columns - Array of {prompt, response} from frontend columns
 * @param {string} options.rawJson - Raw JSON input from textarea
 * @param {File|null} options.file - Uploaded JSON file
 * @param {number} options.trainCycles - Number of training cycles
 */
export async function runFTrainer({ columns = [], rawJson = "", file = null, trainCycles = 1 }) {
  try {
    const renderUrl = "https://fweb-backend.onrender.com/train"; // Render backend

    // 1️⃣ Normalize columns input
    let data = (columns || []).map(pair => ({
      prompt: pair.prompt || "",
      response: pair.response || ""
    }));

    // 2️⃣ Parse raw JSON
    if (rawJson) {
      try {
        const parsed = JSON.parse(rawJson);
        if (Array.isArray(parsed)) data = data.concat(parsed);
        else if (parsed.prompt && parsed.response) data.push(parsed);
      } catch (err) {
        console.warn("⚠️ Invalid raw JSON, skipping:", err.message);
      }
    }

    // 3️⃣ Parse uploaded file
    if (file) {
      const text = await file.text();
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) data = data.concat(parsed);
        else if (parsed.prompt && parsed.response) data.push(parsed);
      } catch (err) {
        console.warn("⚠️ Could not parse uploaded file:", err.message);
      }
    }

    if (!data.length) return { success: false, error: "No valid training data provided." };

    console.log(`🚀 Starting ${trainCycles} training cycle(s)...`);

    let finalResult = null;

    // 4️⃣ Loop through training cycles
    for (let round = 1; round <= trainCycles; round++) {
      console.log(`🔁 Training round ${round}/${trainCycles}...`);

      // POST to Render backend → Render forwards to Colab
      const res = await axios.post(
        renderUrl,
        { data }, // send all data
        { headers: { "Content-Type": "application/json" }, timeout: 1000 * 60 * 5 } // 5 min
      );

      const result = res.data;
      finalResult = result;

      // 5️⃣ Display epoch logs if present
      if (result.training_logs && result.training_logs.length) {
        console.log("📄 Training Logs:");
        result.training_logs.forEach(line => console.log(line));
      }

      // 6️⃣ Show download link if available
      if (result.download_url) console.log("⬇️ Model checkpoint available at:", result.download_url);

      if (result.success) console.log(`✅ Training round ${round} complete.`);
      else {
        console.error(`❌ Training round ${round} failed: ${result.error || "Unknown error"}`);
        break;
      }
    }

    console.log("🏁 All training cycles complete.");
    return finalResult;

  } catch (err) {
    console.error("❌ Error contacting Render backend:", err.message);
    return { success: false, error: "Failed to reach Render backend", details: err.message };
  }
}
