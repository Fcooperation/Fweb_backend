import { v2 as cloudinary } from "cloudinary";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import os from "os";

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

// ---------------- HELPERS ----------------
function runCompression(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-vf scale=480:-2",      // 🔥 reduce resolution (KEY for data saving)
        "-r 30",                 // smooth playback
        "-c:v libx264",
        "-crf 32",               // 🔥 heavy compression (important for students/data saving)
        "-preset veryfast",
        "-c:a aac",
        "-b:a 96k"
      ])
      .on("end", resolve)
      .on("error", reject)
      .save(outputPath);
  });
}

// ---------------- MAIN UPLOAD HANDLER ----------------
export default async function fvidUpload(req, res) {
  try {
    if (!req.file) {
      return res.json({
        success: false,
        error: "No file uploaded"
      });
    }

    const inputPath = path.join(os.tmpdir(), `input-${Date.now()}.mp4`);
    const outputPath = path.join(os.tmpdir(), `output-${Date.now()}.mp4`);

    // ---------------- 1. SAVE TEMP FILE ----------------
    fs.writeFileSync(inputPath, req.file.buffer);

    // ---------------- 2. COMPRESS VIDEO (🔥 NEW CORE LOGIC) ----------------
    await runCompression(inputPath, outputPath);

    const compressedBuffer = fs.readFileSync(outputPath);

    // ---------------- 3. UPLOAD COMPRESSED VIDEO TO CLOUDINARY ----------------
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
        .end(compressedBuffer);
    });

    // ---------------- 4. GET META FROM REQUEST ----------------
    const {
      category,
      language,
      hashtags,
      details,
      user_id
    } = req.body;

    // ---------------- 5. INSERT INTO SUPABASE ----------------
    const { data, error } = await supabase
      .from("fvids")
      .insert([
        {
          video_url: result.secure_url,   // 🔥 NOW THIS IS COMPRESSED VIDEO
          public_id: result.public_id,
          duration: result.duration || null,
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

    // ---------------- 6. CLEANUP TEMP FILES ----------------
    try {
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
    } catch (e) {
      console.log("Cleanup warning:", e.message);
    }

    // ---------------- 7. RETURN SUCCESS ----------------
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
