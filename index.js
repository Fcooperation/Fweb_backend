import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 5000;

// Create uploads folder if it doesn’t exist
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer setup (to handle image uploads)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// Serve uploaded files as static
app.use("/uploads", express.static(uploadDir));

// Upload endpoint
app.post("/upload", upload.single("profilePic"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  // File saved on server
  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

  return res.json({
    success: true,
    url: fileUrl, // Send back URL for frontend
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
