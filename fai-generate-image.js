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


      // Detect image type
      let imageMimeType = "image/png";
      let extension = "png";


      // JPEG
      if (
        imageInput[0] === 0xFF &&
        imageInput[1] === 0xD8 &&
        imageInput[2] === 0xFF
      ) {

        imageMimeType = "image/jpeg";
        extension = "jpg";

      }


      // PNG
      else if (
        imageInput[0] === 0x89 &&
        imageInput[1] === 0x50 &&
        imageInput[2] === 0x4E &&
        imageInput[3] === 0x47
      ) {

        imageMimeType = "image/png";
        extension = "png";

      }


      // WEBP
      else if (
        imageInput[0] === 0x52 &&
        imageInput[1] === 0x49 &&
        imageInput[2] === 0x46 &&
        imageInput[3] === 0x46
      ) {

        imageMimeType = "image/webp";
        extension = "webp";

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
        `input.${extension}`
      );

    }


    // =====================================================
    // GENERATION
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
    // CLOUDFLARE HTTP ERROR
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
    // CLOUDFLARE RETURNS JSON
    // =====================================================

    const cloudflareData =
      await response.json();


    // =====================================================
    // CHECK CLOUDFLARE RESULT
    // =====================================================

    if (
      !cloudflareData ||
      !cloudflareData.result
    ) {

      console.error(
        "❌ Invalid Cloudflare response:",
        cloudflareData
      );

      throw new Error(
        "Cloudflare returned an invalid image response."
      );

    }


    const base64Image =
      cloudflareData.result.image;


    if (
      !base64Image ||
      typeof base64Image !== "string"
    ) {

      console.error(
        "❌ Cloudflare image missing:",
        cloudflareData
      );

      throw new Error(
        "Cloudflare did not return an image."
      );

    }


    // =====================================================
    // CREATE BROWSER DATA URL
    // =====================================================

    /*
      FLUX.2 Klein returns JPEG Base64.

      Cloudflare gives us:

      /9j/4AAQSkZJRg...

      The browser needs:

      data:image/jpeg;base64,/9j/4AAQSkZJRg...
    */

    const dataUrl =
      `data:image/jpeg;base64,${base64Image}`;


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
        "image/jpeg",

      answer:
        mode === "edit"
          ? "I edited your image according to your instruction."
          : "I generated a new image according to your prompt.",

      cloudflare: {
        model:
          MODEL
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