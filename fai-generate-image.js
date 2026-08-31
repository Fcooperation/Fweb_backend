import "dotenv/config";
import { InferenceClient } from "@huggingface/inference";

const MODEL = "black-forest-labs/FLUX.1-Kontext-dev";

export async function generateFAIImage(prompt, imageInput = null) {
  const ACCESS_TOKEN = process.env.HF_ACCESS_TOKEN;

  if (!ACCESS_TOKEN) {
    throw new Error("HF_ACCESS_TOKEN is missing from .env");
  }

  if (!prompt || !prompt.trim()) {
    throw new Error("Image prompt is required");
  }

  try {
    const hf = new InferenceClient(ACCESS_TOKEN);

    let imageBlob = null;

    // ----------------------------------------
    // If an image was uploaded, prepare it
    // ----------------------------------------
    if (imageInput) {
      if (Buffer.isBuffer(imageInput)) {
        imageBlob = new Blob([imageInput]);
      } else {
        throw new Error("Unsupported image input");
      }
    }

    let result;

    // ----------------------------------------
    // IMAGE EDITING
    // Image + prompt
    // ----------------------------------------
    if (imageBlob) {
      console.log("🖼️ FAI image edit requested");

      result = await hf.imageToImage({
        model: MODEL,
        provider: "auto",
        inputs: imageBlob,
        parameters: {
          prompt: prompt.trim()
        }
      });

    } else {
      // ----------------------------------------
      // IMAGE GENERATION
      // Prompt only
      // ----------------------------------------
      console.log("🎨 FAI image generation requested");

      result = await hf.textToImage({
        model: MODEL,
        provider: "auto",
        inputs: prompt.trim()
      });
    }

    // ----------------------------------------
    // Convert result to base64
    // ----------------------------------------

    const arrayBuffer = await result.arrayBuffer();

    const base64Image = Buffer
      .from(arrayBuffer)
      .toString("base64");

    const mimeType = result.type || "image/png";

    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    return {
      success: true,

      provider: "huggingface",

      mode: imageBlob
        ? "edit"
        : "generate",

      model: MODEL,

      image: dataUrl,

      imageUrl: dataUrl,

      mime_type: mimeType,

      answer: imageBlob
        ? "I edited your image according to your instruction."
        : "I generated a new image according to your prompt.",

      huggingface: {
        model: MODEL,
        provider: "auto"
      }
    };

  } catch (error) {

    console.error(
      "❌ FAI Image Error:",
      error
    );

    throw new Error(
      error?.message ||
      "Hugging Face image processing failed."
    );
  }
}