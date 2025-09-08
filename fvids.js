export async function fetchVideos(query) {
  const results = [
    { url: "https://example.com/video1.mp4", title: "Video 1" },
    { url: "https://example.com/video2.mp4", title: "Video 2" },
  ];

  return results; // MUST be an array
}
