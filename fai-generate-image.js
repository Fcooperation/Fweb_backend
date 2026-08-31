import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

export async function generateFAIImage(prompt) {
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is missing from .env"
    );
  }

  if (!prompt) {
    throw new Error(
      "Image prompt is required"
    );
  }

  /*
    -----------------------------------------
    INITIALIZE GEMINI SDK
    -----------------------------------------
  */
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  try {
    /*
      -----------------------------------------
      GENERATE IMAGE WITH GEMINI 2.5 FLASH
      -----------------------------------------
    */
    const response = await ai.models.generateImages({
      model: "gemini-2.5-flash-image",
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: "image/jpeg",
        aspectRatio: "1:1", // Options: "1:1", "3:4", "4:3", "16:9"
      },
    });

    /*
      -----------------------------------------
      CHECK RESULTS
      -----------------------------------------
    */
    const generatedImages = response.generatedImages;
    if (!generatedImages || generatedImages.length === 0) {
      throw new Error(
        "Gemini failed to generate an image for this prompt."
      );
    }

    /*
      -----------------------------------------
      PROCESS IMAGE DATA
      -----------------------------------------
      Gemini returns the image as raw base64 bytes. 
      We format it into a Data URL so your frontend <img> tag 
      can render it instantly without needing a hosted URL link.
    */
    const base64ImageBytes = generatedImages[0].image.imageBytes;
    const dataUrl = `data:image/jpeg;base64,${base64ImageBytes}`;

    /*
      -----------------------------------------
      RETURN IMAGE (Matching Frontend Expectation)
      -----------------------------------------
    */
    return {
      success: true,
      provider: "gemini",
      image: dataUrl,       // Base64 string directly usable in src="..."
      imageUrl: dataUrl,    // Kept for frontend structural consistency
      mime_type: "image/jpeg",
      answer: `I generated a brand new image matching "${prompt}" using Gemini.`,
      gemini: {
        model: "gemini-2.5-flash-image",
        aspectRatio: "1:1",
      }
    };

  } catch (error) {
    console.error("❌ Gemini Image Generation error:", error);
    throw new Error(
      error?.message || "Gemini image generation failed"
    );
  }
}
