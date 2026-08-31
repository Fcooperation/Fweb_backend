import "dotenv/config";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

const MODEL = "@cf/stabilityai/stable-diffusion-xl-base-1.0";

export async function generateFAIImage(prompt, imageInput = null) {

  if (!ACCOUNT_ID) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID is missing from .env");
  }

  if (!API_TOKEN) {
    throw new Error("CLOUDFLARE_API_TOKEN is missing from .env");
  }

  if (!prompt || !prompt.trim()) {
    throw new Error("Image prompt is required");
  }

  try {

    let mode = "generate";
    let body = {
      prompt: prompt.trim()
    };

    // =====================================================
    // IMAGE EDITING
    // =====================================================

    if (imageInput) {

      console.log("🖼️ FAI image editing requested");

      if (!Buffer.isBuffer(imageInput)) {
        throw new Error("Uploaded image must be a Buffer");
      }

      mode = "edit";

      const imageBase64 =
        imageInput.toString("base64");

      body = {
        prompt: prompt.trim(),

        image_b64: imageBase64,

        // Lower = preserve more of original image
        // Higher = follow the prompt more strongly
        strength: 0.7,

        guidance: 7.5,

        num_steps: 20
      };

    }

    // =====================================================
    // IMAGE GENERATION
    // =====================================================

    else {

      console.log("🎨 FAI image generation requested");

      body = {
        prompt: prompt.trim(),

        width: 1024,

        height: 1024,

        num_steps: 20,

        guidance: 7.5
      };

    }

    // =====================================================
    // CLOUDFLARE WORKERS AI REQUEST
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
    // HANDLE CLOUDFLARE ERROR
    // =====================================================

    if (!response.ok) {

      const errorText =
        await response.text();

      console.error(
        "❌ Cloudflare AI error:",
        errorText
      );

      throw new Error(
        `Cloudflare Workers AI failed (${response.status}): ${errorText}`
      );

    }

    // =====================================================
    // CLOUDFLARE RETURNS IMAGE DATA
    // =====================================================

    const imageBuffer =
      Buffer.from(
        await response.arrayBuffer()
      );

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

      provider: "cloudflare-workers-ai",

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