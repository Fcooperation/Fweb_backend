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
  cloudinary.uploader.upload_stream(
    {
      resource_type: "video",
      folder: "fvids",

      // IMPORTANT: ensure eager transformation is triggered
      eager: [
        {
          width: 1280,
          height: 720,
          crop: "limit",
          fps: 30,
          video_codec: "h264",
          bitrate: "1000k",
          audio_codec: "aac",
          format: "mp4"
        }
      ]
    },
    (error, result) => {
      if (error) reject(error);
      else resolve(result);
    }
  ).end(req.file.buffer);
});

console.log("CLOUDINARY RESULT:", JSON.stringify(result, null, 2));

// ---------------- 2. STRICT EAGER CHECK ----------------
const eagerVideo = result?.eager?.[0];

if (!eagerVideo || !eagerVideo.secure_url) {
  return res.json({
    success: false,
    error: "Eager transformation failed",
    reason: "Cloudinary did not return eager video. Check upload preset or transformation config.",
    debug: result
  });
}

const compressedUrl = eagerVideo.secure_url;

// ---------------- 3. GET META ----------------
const {
  category,
  language,
  hashtags,
  details,
  user_id
} = req.body;

// ---------------- 4. INSERT INTO SUPABASE ----------------
const { data, error } = await supabase
  .from("fvids")
  .insert([
    {
      video_url: compressedUrl,
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

// ---------------- 5. RETURN SUCCESS ----------------
return res.json({
  success: true,

  original_video_url: result.secure_url,
  compressed_video_url: compressedUrl,

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
