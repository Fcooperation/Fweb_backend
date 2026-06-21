import { v2 as cloudinary } from "cloudinary";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import { sendProgress } from "./index.js";

// ---------------- CLOUDINARY CONFIG ----------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ---------------- SUPABASE CONFIG ----------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ---------------- MAIN UPLOAD HANDLER ----------------
export default async function fvidUpload(req, res) {
  try {
    if (!req.file) {
      return res.json({
        success: false,
        error: "No file uploaded"
      });
    }

    const {
      category,
      language,
      hashtags,
      details,
      user_id
    } = req.body;

    // ---------------- 1. START PROGRESS ----------------
    sendProgress(user_id, {
      type: "upload",
      stage: "starting",
      progress: 5
    });

    // ---------------- 2. UPLOAD TO CLOUDINARY ----------------
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: "video",
          folder: "fvids"
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      stream.end(req.file.buffer);

      sendProgress(user_id, {
        type: "upload",
        stage: "uploading",
        progress: 50
      });
    });

    // ---------------- 3. OPTIMIZED URL ----------------
    const optimizedUrl = result.secure_url.replace(
      "/upload/",
      "/upload/q_auto,f_auto,w_720/"
    );

    sendProgress(user_id, {
      type: "upload",
      stage: "processing",
      progress: 80
    });

    // ---------------- 4. INSERT INTO SUPABASE ----------------
    const { data, error } = await supabase
      .from("fvids")
      .insert([
        {
          video_url: optimizedUrl,
          public_id: result.public_id,
          duration: result.duration,
          category: category || null,
          language: language || null,
          hashtags: hashtags ? JSON.parse(hashtags) : [],
          details: details || null,
          user_id: user_id || null,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      sendProgress(user_id, {
        type: "upload",
        stage: "error",
        progress: 0,
        error: error.message
      });

      return res.json({
        success: false,
        error: error.message
      });
    }

    // ---------------- 5. DONE ----------------
    sendProgress(user_id, {
      type: "upload",
      stage: "done",
      progress: 100,
      video_url: optimizedUrl
    });

    return res.json({
      success: true,
      video_url: optimizedUrl,
      public_id: result.public_id,
      db_record: data
    });

  } catch (err) {
    console.error("FVID UPLOAD ERROR:", err);

    return res.json({
      success: false,
      error: err.message
    });
  }
        }
