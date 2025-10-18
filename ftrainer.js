// render-backend.js
import axios from "axios";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const { columns = [], rawJson = "", fileData = null, trainCycles = 1 } = req.body;

    // 1️⃣ Normalize frontend data
    let data = (columns || []).map(pair => ({
      prompt: pair.prompt || "",
      response: pair.response || ""
    }));

    // 2️⃣ Parse raw JSON input if present
    if (rawJson) {
      try {
        const parsed = JSON.parse(rawJson);
        if (Array.isArray(parsed)) data = data.concat(parsed);
        else if (parsed.prompt && parsed.response) data.push(parsed);
      } catch (err) {
        console.warn("⚠️ Invalid raw JSON, skipping:", err.message);
      }
    }

    // 3️⃣ Parse uploaded file data if present
    if (fileData) {
      try {
        const parsed = JSON.parse(fileData);
        if (Array.isArray(parsed)) data = data.concat(parsed);
        else if (parsed.prompt && parsed.response) data.push(parsed);
      } catch (err) {
        console.warn("⚠️ Could not parse uploaded file data:", err.message);
      }
    }

    if (!data.length) {
      return res.status(400).json({ success: false, error: "No valid training data provided." });
    }

    console.log(`🚀 Forwarding ${trainCycles} training cycle(s) to Colab...`);

    // 4️⃣ Forward payload to Colab
    const colabUrl = "https://mindy-sinistrous-fortuitously.ngrok-free.dev/train";
    const colabRes = await axios.post(colabUrl, { data, trainCycles }, {
      headers: { "Content-Type": "application/json" },
      timeout: 5 * 60 * 1000, // 5 minutes
    });

    console.log("✅ Response from Colab received.");
    if (colabRes.data.training_logs && colabRes.data.training_logs.length) {
      console.log("📄 Training logs from Colab:");
      colabRes.data.training_logs.forEach(line => console.log(line));
    }

    // 5️⃣ Return Colab response back to frontend
    res.status(200).json({
      success: true,
      message: "Data forwarded to Colab successfully.",
      colabResponse: colabRes.data
    });

  } catch (err) {
    console.error("❌ Error forwarding to Colab:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
