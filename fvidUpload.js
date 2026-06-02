import { v2 as cloudinary } from "cloudinary";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

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

    // ---------------- 1. UPLOAD TO CLOUDINARY ----------------
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: "video",
            folder: "fvids"
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        )
        .end(req.file.buffer);
    });

    // ---------------- 2. GET META FROM REQUEST ----------------
    const {
      category,
      language,
      hashtags,
      details,
      user_id
    } = req.body;

    // ---------------- 3. INSERT INTO SUPABASE ----------------
    const { data, error } = await supabase
      .from("fvids")
      .insert([
        {
          video_url: result.secure_url,
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
      console.error("SUPABASE INSERT ERROR:", error);
      return res.json({
        success: false,
        error: error.message
      });
    }

    // ---------------- 4. RETURN SUCCESS ----------------
    return res.json({
      success: true,
      video_url: result.secure_url,
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
