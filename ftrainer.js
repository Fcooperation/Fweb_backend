// ftrainer.js
import axios from "axios";
import FormData from "form-data"; // ensure this is installed

export async function runFTrainer(datasetFile, params = {}) {
  try {
    const colabUrl = "https://mindy-sinistrous-fortuitously.ngrok-free.dev/train";

    // Build multipart form-data payload
    const formData = new FormData();
    if (datasetFile) {
      // datasetFile can be fs.createReadStream("path/to/file.csv") in Node
      formData.append("dataset", datasetFile);
    }
    formData.append("parameters", JSON.stringify(params));
    formData.append("gpu", params.gpu || "false");
    formData.append("storage", params.storage || "drive");

    // Send to Colab backend
    const res = await axios.post(colabUrl, formData, {
      headers: formData.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 1000 * 60 * 10 // allow 10 mins for training
    });

    const data = res.data;

    return {
      success: true,
      logs: data.logs || "No logs received",
      metrics: data.metrics || {},
      model_url: data.model_url || null,
    };
  } catch (err) {
    console.error("❌ Colab error:", err.message);
    return {
      success: false,
      error: "Failed to reach Colab",
      details: err.message,
    };
  }
}
