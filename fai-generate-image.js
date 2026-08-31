import "dotenv/config";

const ACCOUNT_ID =
  process.env.CLOUDFLARE_ACCOUNT_ID;

const API_TOKEN =
  process.env.CLOUDFLARE_API_TOKEN;

const MODEL =
  "@cf/black-forest-labs/flux-2-klein-4b";


export async function generateFAIImage(
  prompt,
  imageInput = null
) {

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
    throw new Error(
      "Image prompt is required"
    );
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


      /*
        Try to detect the image type.

        If the uploaded image is PNG,
        JPEG, WEBP, etc., use the correct
        MIME type instead of always saying PNG.
      */

      let imageMimeType =
        "image/png";


      /*
        Detect common image formats
        from their binary signatures.
      */

      if (
        imageInput[0] === 0xFF &&
        imageInput[1] === 0xD8 &&
        imageInput[2] === 0xFF
      ) {

        imageMimeType =
          "image/jpeg";

      }

      else if (
        imageInput[0] === 0x89 &&
        imageInput[1] === 0x50 &&
        imageInput[2] === 0x4E &&
        imageInput[3] === 0x47
      ) {

        imageMimeType =
          "image/png";

      }

      else if (
        imageInput[0] === 0x52 &&
        imageInput[1] === 0x49 &&
        imageInput[2] === 0x46 &&
        imageInput[3] === 0x46
      ) {

        imageMimeType =
          "image/webp";

      }


      const imageBlob =
        new Blob(
          [imageInput],
          {
            type: imageMimeType
          }
        );


      form.append(
        "input_image_0",
        imageBlob,
        `input.${
          imageMimeType === "image/jpeg"
            ? "jpg"
            : imageMimeType === "image/webp"
              ? "webp"
              : "png"
        }`
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


    const response =
      await fetch(
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
    // CLOUDFLARE ERROR
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
    // GET RESPONSE CONTENT TYPE
    // =====================================================

    const responseContentType =
      response.headers.get(
        "content-type"
      ) || "";


    /*
      Cloudflare image models should return
      binary image data.

      If Cloudflare unexpectedly returns JSON,
      don't turn that JSON into a fake image.
    */

    if (
      responseContentType.includes(
        "application/json"
      )
    ) {

      const jsonText =
        await response.text();

      console.error(
        "❌ Cloudflare returned JSON instead of an image:",
        jsonText
      );

      let cloudflareError =
        jsonText;

      try {

        const json =
          JSON.parse(jsonText);

        cloudflareError =
          json?.errors?.[0]?.message ||
          json?.message ||
          jsonText;

      } catch {
        // Keep original response
      }

      throw new Error(
        `Cloudflare returned JSON instead of an image: ${cloudflareError}`
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


    // =====================================================
    // DETERMINE IMAGE TYPE
    // =====================================================

    let mimeType =
      "image/png";


    /*
      Use Cloudflare's content type only
      if it is actually an image.
    */

    if (
      responseContentType.startsWith(
        "image/"
      )
    ) {

      mimeType =
        responseContentType
          .split(";")[0]
          .trim();

    }


    // =====================================================
    // CONVERT IMAGE TO BASE64
    // =====================================================

    const base64Image =
      imageBuffer.toString(
        "base64"
      );


    /*
      IMPORTANT:

      This creates a valid browser image
      data URL:

      data:image/png;base64,...

      or

      data:image/jpeg;base64,...
    */

    const dataUrl =
      `data:${mimeType};base64,${base64Image}`;


    // =====================================================
    // FINAL RESPONSE
    // =====================================================

    return {

      success: true,

      provider:
        "cloudflare-workers-ai",

      mode,

      model:
        MODEL,

      image:
        dataUrl,

      imageUrl:
        dataUrl,

      mime_type:
        mimeType,

      answer:
        mode === "edit"
          ? "I edited your image according to your instruction."
          : "I generated a new image according to your prompt.",

      cloudflare: {
        model:
          MODEL,

        content_type:
          responseContentType,

        image_size:
          imageBuffer.length
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