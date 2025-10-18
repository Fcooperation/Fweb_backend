// ftrainer.js
import axios from "axios";

export async function runFTrainer({ columns, rawJson, file }) {
  try {
    const renderUrl = "https://fweb-backend.onrender.com/train";

    // Normalize columns input
    let data = columns.map(pair => ({
      prompt: pair.prompt || "",
      response: pair.response || ""
    }));

    // Parse raw JSON input
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

    if (!data.length) return { success: false, error: "No valid training data" };

    // Send training request to Render
    const res = await axios.post(renderUrl, { data }, {
      headers: { "Content-Type": "application/json" },
      timeout: 1000 * 60 * 5, // 5 min timeout for longer training
    });

    const result = res.data;

    // Include training logs if available
    if (result.training_logs) {
      console.log("📄 Training Logs:");
      result.training_logs.forEach(line => console.log(line));
    }

    // Include download URL if present
    if (result.download_url) {
      console.log("⬇️ Model checkpoint available at:", result.download_url);
    }

    return result;

  } catch (err) {
    console.error("❌ Error contacting Render backend:", err.message);
    return { success: false, error: "Failed to reach Render backend", details: err.message };
  }
}
