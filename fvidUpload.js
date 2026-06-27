import { v2 as cloudinary } from "cloudinary";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import { algoliasearch } from "algoliasearch";

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

// --------------- ALGOLIA CONFIG ---------------
const algolia = algoliasearch(
  process.env.ALGOLIA_APP_ID,
  process.env.ALGOLIA_ADMIN_API_KEY
);

await algolia.setSettings({
  indexName: process.env.ALGOLIA_INDEX,
  settings: {
    searchableAttributes: [
      "username",
      "hashtags",
      "details",
      "category"
    ]
  }
});

// ---------------- MAIN UPLOAD HANDLER ----------------
export default async function fvidUpload(req, res) {
  try {

    // ================================
    // 0. VALIDATE MULTER INPUT
    // ================================
    const videoFile = req.files?.file?.[0];
    const thumbnailFile = req.files?.thumbnail?.[0];

    if (!videoFile) {
      return res.json({
        success: false,
        error: "No video uploaded"
      });
    }

    // ================================
    // 1. UPLOAD VIDEO TO CLOUDINARY
    // ================================
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: "video",
            folder: "fvids",

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
        )
        .end(videoFile.buffer);
    });

    console.log("CLOUDINARY VIDEO RESULT:", result);

    const eagerVideo = result?.eager?.[0];

    if (!eagerVideo?.secure_url) {
      return res.json({
        success: false,
        error: "Video compression failed",
        debug: result
      });
    }

    const compressedUrl = eagerVideo.secure_url;

    // ================================
    // 2. UPLOAD THUMBNAIL TO CLOUDINARY
    // ================================
    let thumbnailUrl = null;
    let thumbnailPublicId = null;

    if (thumbnailFile) {

      const thumbResult = await cloudinary.uploader.upload(
        `data:image/jpeg;base64,${thumbnailFile.buffer.toString("base64")}`,
        {
          folder: "fvids/thumbnails",
          resource_type: "image"
        }
      );

      thumbnailUrl = thumbResult.secure_url;
      thumbnailPublicId = thumbResult.public_id;

    } else {

      const autoThumb = cloudinary.url(result.public_id, {
        resource_type: "video",
        format: "jpg",
        transformation: [
          { start_offset: 2 }
        ]
      });

      thumbnailUrl = autoThumb;
      thumbnailPublicId = result.public_id;
    }

    // ================================
    // 3. META DATA
    // ================================
    const {
      category,
      language,
      hashtags,
      details,
      user_id
    } = req.body;

    // ================================
    // 4. INSERT INTO SUPABASE
    // ================================
    const { data, error } = await supabase
      .from("fvids")
      .insert([
        {
          video_url: compressedUrl,
          public_id: result.public_id,

          thumbnail_url: thumbnailUrl,
          thumbnail_public_id: thumbnailPublicId,

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
      console.error("SUPABASE ERROR:", error);

      return res.json({
        success: false,
        error: error.message
      });
    }

    // ================================
// GET USER DETAILS
// ================================

const { data: account } = await supabase
  .from("fwebaccount")
  .select("username, profile_pic")
  .eq("id", data.user_id)
  .single();

    // ================================
// 5. SAVE TO ALGOLIA
// ================================

await algolia.saveObjects({
  indexName: process.env.ALGOLIA_INDEX,
  objects: [
    {
      objectID: String(data.id),

      type: "video",

      video_id: data.id,
      user_id: data.user_id,

      username: account?.username || "",
      profile_pic: account?.profile_pic || "",

      category: data.category,
      language: data.language,

      hashtags: data.hashtags || [],
      details: data.details || "",

      thumbnail_url: data.thumbnail_url,
      video_url: data.video_url,

      duration: data.duration,

      // Engagement
      likes_count: 0,
      views_count: 0,

      created_at: data.created_at
    }
  ]
});

    // ================================
    // 6. RESPONSE
    // ================================
    return res.json({
      success: true,

      video_url: compressedUrl,
      thumbnail_url: thumbnailUrl,

      video_public_id: result.public_id,
      thumbnail_public_id: thumbnailPublicId,

      duration: result.duration,
      db_record: data
    });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);

    return res.json({
      success: false,
      error: err.message
    });
  }
          }