import "dotenv/config";

export async function generateFAIImage(prompt) {
  const ACCESS_TOKEN = process.env.HF_ACCESS_TOKEN;

  if (!ACCESS_TOKEN) {
    throw new Error("HF_ACCESS_TOKEN is missing from .env");
  }

  if (!prompt) {
    throw new Error("Image prompt is required");
  }

  // Target a highly stable open-source text-to-image endpoint
  const MODEL_URL = "https://huggingface.co";

  try {
    const response = await fetch(MODEL_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    // Check if the server is still booting up the model ("Cold Start")
    if (response.status === 503) {
      console.warn("⚠️ Hugging Face model is warming up... Retrying soon.");
      throw new Error("AI model is currently loading into memory. Please try again in a few seconds.");
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Hugging Face API error:", errorText);
      throw new Error("Hugging Face failed to process your image request.");
    }

    // Hugging Face returns raw binary data directly instead of JSON strings
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");
    
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;

    return {
      success: true,
      provider: "huggingface",
      image: dataUrl,
      imageUrl: dataUrl,
      mime_type: "image/jpeg",
      answer: `I generated a brand new image matching "${prompt}" using Hugging Face.`,
      huggingface: {
        model: "stable-diffusion-2-1",
      }
    };

  } catch (error) {
    console.error("❌ Image Generation Exception:", error);
    throw new Error(error?.message || "Hugging Face processing failed");
  }
}
