import "dotenv/config";

const PIXABAY_API_URL =
  "https://pixabay.com/api/";

export async function generateFAIImage(prompt) {

  const API_KEY =
    process.env.PIXABAY_API_KEY;

  if (!API_KEY) {
    throw new Error(
      "PIXABAY_API_KEY is missing from .env"
    );
  }

  if (!prompt) {
    throw new Error(
      "Image prompt is required"
    );
  }

  /*
    -----------------------------------------
    SEARCH PIXABAY
    -----------------------------------------
  */

  const params = new URLSearchParams({

    key: API_KEY,

    q: prompt,

    image_type: "photo",

    safesearch: "true",

    per_page: "20",

    page: "1"

  });

  const response =
    await fetch(
      `${PIXABAY_API_URL}?${params.toString()}`
    );

  const data =
    await response.json();

  if (!response.ok) {

    console.error(
      "❌ Pixabay API error:",
      data
    );

    throw new Error(
      data?.error ||
      "Pixabay image search failed"
    );
  }

  /*
    -----------------------------------------
    CHECK RESULTS
    -----------------------------------------
  */

  if (
    !data.hits ||
    !data.hits.length
  ) {

    throw new Error(
      "No suitable image was found on Pixabay."
    );
  }

  /*
    -----------------------------------------
    PICK BEST RESULT
    -----------------------------------------

    Pixabay returns several images.

    We use the first result for now.
  */

  const image =
    data.hits[0];

  const imageUrl =
    image.largeImageURL ||
    image.webformatURL;

  if (!imageUrl) {

    throw new Error(
      "Pixabay returned an image without a usable URL."
    );
  }

  /*
    -----------------------------------------
    RETURN IMAGE
    -----------------------------------------
  */

  return {

    success: true,

    provider: "pixabay",

    image: imageUrl,

    imageUrl: imageUrl,

    mime_type: "image/jpeg",

    answer:
      `I found an image matching "${prompt}" on Pixabay.`,

    pixabay: {

      id: image.id,

      tags: image.tags,

      pageURL: image.pageURL,

      previewURL: image.previewURL,

      webformatURL: image.webformatURL,

      largeImageURL:
        image.largeImageURL

    }

  };

}