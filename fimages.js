// fimages.js
import axios from "axios";

const PIXABAY_KEY = "52236532-a5106c580da4b432f21d142e7";

export async function fetchImages(query) {
  if (!query) return [];

  try {
    const url = `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(
      query
    )}&image_type=photo&per_page=20`;

    const response = await axios.get(url);

    if (response.data && response.data.hits) {
      return response.data.hits.map((hit) => ({
        url: hit.largeImageURL,
        thumbnail: hit.previewURL,
        source: hit.pageURL,
      }));
    }

    return [];
  } catch (err) {
    console.error("❌ Pixabay image fetch failed:", err.message);
    return [];
  }
}
