import "dotenv/config";
import { InferenceClient } from "@huggingface/inference";

// Model for NEW images
const GENERATION_MODEL = "black-forest-labs/FLUX.1-schnell";

// Model for EDITING existing images
const EDIT_MODEL = "black-forest-labs/FLUX.1-Kontext-dev";

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

    let result;
    let mode;

    // =====================================================
    // EDIT IMAGE
    // =====================================================

    if (imageInput) {

      console.log("🖼️ FAI image editing requested");

      if (!Buffer.isBuffer(imageInput)) {
        throw new Error("Uploaded image must be a Buffer");
      }

      const imageBlob = new Blob([imageInput]);

      result = await hf.imageToImage({

        model: EDIT_MODEL,

        provider: "auto",

        inputs: imageBlob,

        parameters: {
          prompt: prompt.trim()
        }

      });

      mode = "edit";

    }

    // =====================================================
    // GENERATE IMAGE
    // =====================================================

    else {

      console.log("🎨 FAI image generation requested");

      result = await hf.textToImage({

        model: GENERATION_MODEL,

        provider: "auto",

        inputs: prompt.trim()

      });

      mode = "generate";

    }

    // =====================================================
    // CONVERT IMAGE TO BASE64
    // =====================================================

    const arrayBuffer = await result.arrayBuffer();

    const base64Image = Buffer
      .from(arrayBuffer)
      .toString("base64");

    const mimeType = result.type || "image/png";

    const dataUrl =
      `data:${mimeType};base64,${base64Image}`;

    // =====================================================
    // RESPONSE
    // =====================================================

    return {

      success: true,

      provider: "huggingface",

      mode,

      model:
        mode === "edit"
          ? EDIT_MODEL
          : GENERATION_MODEL,

      image: dataUrl,

      imageUrl: dataUrl,

      mime_type: mimeType,

      answer:
        mode === "edit"
          ? "I edited your image according to your instruction."
          : "I generated a new image according to your prompt.",

      huggingface: {

        provider: "auto",

        model:
          mode === "edit"
            ? EDIT_MODEL
            : GENERATION_MODEL

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