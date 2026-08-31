import "dotenv/config";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

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
    // MULTIPART FORM
    // =====================================================

    const form = new FormData();

    form.append(
      "prompt",
      prompt.trim()
    );

    form.append(
      "width",
      "1024"
    );

    form.append(
      "height",
      "1024"
    );

    // =====================================================
    // IMAGE EDITING
    // =====================================================

    if (imageInput) {

      console.log(
        "🖼️ FAI image editing requested"
      );

      if (!Buffer.isBuffer(imageInput)) {
        throw new Error(
          "Uploaded image must be a Buffer"
        );
      }

      mode = "edit";

      // Cloudflare expects the uploaded
      // image as a binary multipart field.
      const imageBlob = new Blob(
        [imageInput],
        {
          type: "image/png"
        }
      );

      form.append(
        "input_image_0",
        imageBlob,
        "input.png"
      );

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
    // CLOUDFLARE API
    // =====================================================

    const url =
      `https://api.cloudflare.com/client/v4/accounts/` +
      `${ACCOUNT_ID}/ai/run/${MODEL}`;

    // IMPORTANT:
    // Do NOT manually set Content-Type.
    //
    // fetch() automatically creates:
    // multipart/form-data; boundary=...
    //
    const response = await fetch(
      url,
      {
        method: "POST",

        headers: {
          "Authorization":
            `Bearer ${API_TOKEN}`
        },

        body: form
      }
    );

    // =====================================================
    // ERROR HANDLING
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
      response.headers.get(
        "content-type"
      ) || "image/png";

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