import "dotenv/config";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

// FLUX.2 Klein 4B
// Supports both image generation and image editing
const MODEL = "@cf/black-forest-labs/flux-2-klein-4b";

export async function generateFAIImage(prompt, imageInput = null) {

  if (!ACCOUNT_ID) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID is missing from .env"
    );
  }

  if (!API_TOKEN) {
    throw new Error(
      "CLOUDFLARE_API_TOKEN is missing from .env"
    );
  }

  if (!prompt || !prompt.trim()) {
    throw new Error("Image prompt is required");
  }

  try {

    let mode = "generate";

    // =====================================================
    // REQUEST BODY
    // =====================================================

    const body = {
      prompt: prompt.trim()
    };

    // =====================================================
    // IMAGE EDITING
    // =====================================================

    if (imageInput) {

      console.log("🖼️ FAI image editing requested");

      if (!Buffer.isBuffer(imageInput)) {
        throw new Error(
          "Uploaded image must be a Buffer"
        );
      }

      mode = "edit";

      body.image_b64 =
        imageInput.toString("base64");

    }

    // =====================================================
    // IMAGE GENERATION
    // =====================================================

    else {

      console.log(
        "🎨 FAI image generation requested"
      );

    }

    // =====================================================
    // CLOUDFLARE WORKERS AI
    // =====================================================

    const url =
      `https://api.cloudflare.com/client/v4/accounts/` +
      `${ACCOUNT_ID}/ai/run/${MODEL}`;

    const response = await fetch(url, {

      method: "POST",

      headers: {
        "Authorization": `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json"
      },

      body: JSON.stringify(body)

    });

    // =====================================================
    // ERROR
    // =====================================================

    if (!response.ok) {

      const errorText =
        await response.text();

      console.error(
        "❌ Cloudflare AI error:",
        errorText
      );

      throw new Error(
        `Cloudflare Workers AI failed ` +
        `(${response.status}): ${errorText}`
      );

    }

    // =====================================================
    // IMAGE RESPONSE
    // =====================================================

    const imageBuffer =
      Buffer.from(
        await response.arrayBuffer()
      );

    if (!imageBuffer.length) {
      throw new Error(
        "Cloudflare returned an empty image"
      );
    }

    const base64Image =
      imageBuffer.toString("base64");

    const mimeType =
      response.headers.get("content-type") ||
      "image/png";

    const dataUrl =
      `data:${mimeType};base64,${base64Image}`;

    // =====================================================
    // RESPONSE
    // =====================================================

    return {

      success: true,

      provider:
        "cloudflare-workers-ai",

      mode,

      model: MODEL,

      image: dataUrl,

      imageUrl: dataUrl,

      mime_type: mimeType,

      answer:
        mode === "edit"
          ? "I edited your image according to your instruction."
          : "I generated a new image according to your prompt.",

      cloudflare: {
        model: MODEL
      }

    };

  } catch (error) {

    console.error(
      "❌ FAI Image Error:",
      error
    );

    throw new Error(
      error?.message ||
      "Cloudflare image processing failed."
    );

  }

}