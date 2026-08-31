import "dotenv/config";
import { InferenceClient } from "@huggingface/inference";

export async function generateFAIImage(prompt) {
  const ACCESS_TOKEN = process.env.HF_ACCESS_TOKEN;

  if (!ACCESS_TOKEN) {
    throw new Error("HF_ACCESS_TOKEN is missing from .env");
  }

  if (!prompt || !prompt.trim()) {
    throw new Error("Image prompt is required");
  }

  try {
    const hf = new InferenceClient(ACCESS_TOKEN);

    const image = await hf.textToImage({
      model: "black-forest-labs/FLUX.1-schnell",
      provider: "auto",
      inputs: prompt.trim(),
    });

    const arrayBuffer = await image.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");

    const mimeType = image.type || "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    return {
      success: true,
      provider: "huggingface",
      image: dataUrl,
      imageUrl: dataUrl,
      mime_type: mimeType,
      answer: `I generated a new image based on your prompt.`,
      huggingface: {
        model: "black-forest-labs/FLUX.1-schnell",
        provider: "auto",
      },
    };

  } catch (error) {
    console.error("❌ FAI Image Generation Error:", error);

    throw new Error(
      error?.message || "Hugging Face image generation failed."
    );
  }
}
