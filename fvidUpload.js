import { v2 as cloudinary } from "cloudinary";
import "dotenv/config";

// ---------------- CONFIG ----------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ---------------- MAIN UPLOAD HANDLER ----------------
export default async function fvidUpload(req, res) {
  try {

    if (!req.file) {
      return {
        success: false,
        error: "No file uploaded"
      };
    }

    // Upload buffer to Cloudinary
    const result = await new Promise((resolve, reject) => {

      cloudinary.uploader.upload_stream(
        {
          resource_type: "video", // IMPORTANT for videos
          folder: "fvids"
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }

      ).end(req.file.buffer);

    });

    return {
      success: true,
      video_url: result.secure_url,
      public_id: result.public_id,
      duration: result.duration,
      created_at: result.created_at
    };

  } catch (err) {

    console.error("FVID UPLOAD ERROR:", err);

    return {
      success: false,
      error: err.message
    };
  }
        }
