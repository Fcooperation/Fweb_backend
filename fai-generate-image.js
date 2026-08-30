import "dotenv/config";

const IMAGE_MODEL = "gemini-3.1-flash-image";

export async function generateFAIImage(prompt) {
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  if (!prompt) {
    throw new Error("Image prompt is required");
  }

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY
      },

      body: JSON.stringify({
        model: IMAGE_MODEL,

        input: prompt,

        response_format: {
          type: "image",
          aspect_ratio: "1:1",
          image_size: "1K"
        }
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("❌ Image generation error:", data);

    throw new Error(
      data?.error?.message ||
      "Image generation failed"
    );
  }

  const image = data?.output_image;

  if (!image?.data) {
    throw new Error("Image model returned no image");
  }

  return {
    success: true,
    model: IMAGE_MODEL,
    mime_type: image.mime_type || "image/png",
    image: image.data
  };
}