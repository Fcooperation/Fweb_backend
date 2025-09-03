import axios from "axios";
import fs from "fs";

export async function downloadImage(url, filePath) {
  try {
    const writer = fs.createWriteStream(filePath);
    const response = await axios.get(url, { responseType: "stream" });
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
  } catch (err) {
    console.error("❌ Image download failed:", url, err.message);
  }
}
