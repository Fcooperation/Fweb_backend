import "dotenv/config";
import { GoogleGenAI, Modality } from "@google/genai";

export async function generateFAIImage(prompt) {
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    throw new Error("GEMINI_API_KEY is missing from .env");
  }

  if (!prompt) {
    throw new Error("Image prompt is required");
  }

  // Initialize the SDK for Google AI Studio
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  try {
    /*
      -----------------------------------------
      GENERATE CONTENT WITH IMAGE MODALITY
      -----------------------------------------
      We use the updated gemini-3.6-flash model, which allows
      image modality generations on the standard free tier.
    */
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash", 
      contents: `Generate an image matching this description: ${prompt}`,
      config: {
        // Enforce that the model outputs raw image data bytes
        responseModalities: [Modality.IMAGE],
      },
    });

    /*
      -----------------------------------------
      CHECK & EXTRACT INLINE IMAGE BYTES
      -----------------------------------------
    */
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts;

    if (!parts || parts.length === 0) {
      throw new Error("Gemini returned an empty response layout.");
    }

    // Locate the part containing the inline image data bytes
    const imagePart = parts.find((part) => part.inlineData);

    if (!imagePart || !imagePart.inlineData?.data) {
      throw new Error("Gemini completed the request but did not include image bytes.");
    }

    // The SDK returns image data directly as a base64 string
    const base64ImageBytes = imagePart.inlineData.data;
    const dataUrl = `data:image/jpeg;base64,${base64ImageBytes}`;

    /*
      -----------------------------------------
      RETURN RESPONSE SCHEMA FOR FRONTEND
      -----------------------------------------
    */
    return {
      success: true,
      provider: "gemini",
      image: dataUrl,
      imageUrl: dataUrl,
      mime_type: "image/jpeg",
      answer: `I generated a brand new image matching "${prompt}" using Gemini.`,
      gemini: {
        model: "gemini-3.6-flash",
      },
    };
  } catch (error) {
    console.error("❌ Gemini Image Generation error:", error);
    throw new Error(error?.message || "Gemini image generation failed");
  }
}
