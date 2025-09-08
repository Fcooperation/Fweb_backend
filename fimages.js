export async function fetchImages(query) {
  // Your scraping / API logic here
  // Example:
  const results = [
    { url: "https://example.com/img1.jpg", title: "Image 1" },
    { url: "https://example.com/img2.jpg", title: "Image 2" },
  ];

  return results; // MUST be an array, not wrapped in {images: [...]} 
}
