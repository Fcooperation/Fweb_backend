// ftrainer.js
import axios from "axios";

export async function runFTrainer({ columns = [], rawJson = "", file = null, trainCycles = 1 }) {
  try {
    const renderUrl = "https://fweb-backend.onrender.com/train";

    // Normalize columns input safely
    let data = (columns || []).map(pair => ({
      prompt: pair.prompt || "",
      response: pair.response || ""
    }));

    // Parse raw JSON input safely
    if (rawJson) {
      try {
        const parsed = JSON.parse(rawJson);
        if (Array.isArray(parsed)) data = data.concat(parsed);
        else if (parsed.prompt && parsed.response) data.push(parsed);
      } catch (err) {
        console.warn("⚠️ Invalid raw JSON, skipping:", err.message);
      }
    }

    // Parse uploaded file if present
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

    if (!data.length) {
      return { success: false, error: "No valid training data provided." };
    }

    console.log(`🚀 Starting ${trainCycles} training cycle(s)...`);

    let finalResult = null;

    for (let round = 1; round <= trainCycles; round++) {
      console.log(`🔁 Training round ${round}/${trainCycles}...`);

      const res = await axios.post(renderUrl, { data }, {
        headers: { "Content-Type": "application/json" },
        timeout: 1000 * 60 * 5, // 5 min timeout
      });

      const result = res.data;
      finalResult = result;

      // Log epoch outputs if present
      if (result.training_logs && result.training_logs.length) {
        console.log("📄 Training Logs:");
        result.training_logs.forEach(line => console.log(line));
      }

      if (result.download_url) {
        console.log("⬇️ Model checkpoint available at:", result.download_url);
      }

      if (result.success) {
        console.log(`✅ Training round ${round} complete.`);
      } else {
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
