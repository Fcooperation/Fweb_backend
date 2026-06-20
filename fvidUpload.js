import { v2 as cloudinary } from "cloudinary";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import os from "os";

// 🔥 WebSocket progress sender
import { sendProgress } from "./ws.js";

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
function runCompression(inputPath, outputPath, user_id) {
  return new Promise((resolve, reject) => {

    ffmpeg(inputPath)
      .outputOptions([
        "-vf scale=480:-2",
        "-r 30",
        "-c:v libx264",
        "-crf 32",
        "-preset veryfast",
        "-c:a aac",
        "-b:a 96k"
      ])

      // 🔥 FFmpeg progress tracking
      .on("progress", (progress) => {
        const percent = Math.min(
          95,
          Math.round(progress.percent || 0)
        );

        sendProgress(user_id, {
          stage: "compressing",
          progress: percent
        });
      })

      .on("end", () => {
        sendProgress(user_id, {
          stage: "compressed",
          progress: 100
        });

        resolve();
      })

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

    const {
      category,
      language,
      hashtags,
      details,
      user_id
    } = req.body;

    // 🔥 STEP 0: INIT
    sendProgress(user_id, {
      stage: "upload_received",
      progress: 5
    });

    const inputPath = path.join(os.tmpdir(), `input-${Date.now()}.mp4`);
    const outputPath = path.join(os.tmpdir(), `output-${Date.now()}.mp4`);

    // ---------------- 1. SAVE TEMP FILE ----------------
    fs.writeFileSync(inputPath, req.file.buffer);

    sendProgress(user_id, {
      stage: "file_saved",
      progress: 10
    });

    // ---------------- 2. COMPRESS VIDEO ----------------
    sendProgress(user_id, {
      stage: "compressing_start",
      progress: 15
    });

    await runCompression(inputPath, outputPath, user_id);

    const compressedBuffer = fs.readFileSync(outputPath);

    // ---------------- 3. UPLOAD TO CLOUDINARY ----------------
    sendProgress(user_id, {
      stage: "uploading_cloudinary",
      progress: 95
    });

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

    sendProgress(user_id, {
      stage: "uploaded_cloudinary",
      progress: 98
    });

    // ---------------- 4. INSERT INTO SUPABASE ----------------
    const { data, error } = await supabase
      .from("fvids")
      .insert([
        {
          video_url: result.secure_url,
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

      sendProgress(user_id, {
        stage: "failed",
        progress: 0,
        error: error.message
      });

      return res.json({
        success: false,
        error: error.message
      });
    }

    // ---------------- 5. CLEANUP ----------------
    try {
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
    } catch (e) {
      console.log("Cleanup warning:", e.message);
    }

    // ---------------- 6. DONE ----------------
    sendProgress(user_id, {
      stage: "done",
      progress: 100
    });

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
