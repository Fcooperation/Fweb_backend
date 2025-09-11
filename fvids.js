// fvids.js
import axios from "axios";

const YT_API_KEY = "AIzaSyB6IdRR6pdOLJ3m6T-GuTZ7usoaKp4kbOA";

// Fetch YouTube videos
export async function fetchVideos(query) {
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(
      query
    )}&maxResults=10&key=${YT_API_KEY}`;

    const response = await axios.get(url);

    if (!response.data.items || response.data.items.length === 0) {
      return [];
    }

    // Format results
    return response.data.items.map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.medium.url, // 320px thumbnail
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    }));
  } catch (err) {
    console.error("❌ YouTube API error:", err.message);
    return [];
  }
}
