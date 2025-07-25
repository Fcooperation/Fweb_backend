// index.js
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const GOFILE_API = "https://api.gofile.io";
const GOFILE_TOKEN = "e1LOiRxizCSLqTmyZ27AeZuN10qu0wfO";
const TEMP_BYTE_FILE = "tiny-byte.txt";

// Create a temp 1-byte file if not exists
if (!fs.existsSync(TEMP_BYTE_FILE)) {
  fs.writeFileSync(TEMP_BYTE_FILE, "0");
}

// Route: Health check
app.get("/", (req, res) => {
  res.send("Fserver backend is live!");
});

// Route: Frontend sends online ping here
app.post("/online", async (req, res) => {
  const ip = req.ip;
  const time = new Date().toISOString();
  console.log(`User online: ${ip} at ${time}`);

  try {
    // Step 1: Get user's root folder
    const userResp = await axios.get(`${GOFILE_API}/getAccountDetails?token=${GOFILE_TOKEN}`);
    const rootFolder = userResp.data.data.rootFolder;
    console.log(`Gofile root folder: ${rootFolder}`);

    // Step 2: Get all files inside root folder
    const filesResp = await axios.get(`${GOFILE_API}/getContent?contentId=${rootFolder}`);
    const files = filesResp.data.data.contents || {};

    // Step 3: Upload 1-byte file to touch/update timestamps
    for (const fileId in files) {
      console.log(`Touching file: ${fileId}`);
      const form = new FormData();
      form.append("token", GOFILE_TOKEN);
      form.append("folderId", rootFolder);
      form.append("file", fs.createReadStream(TEMP_BYTE_FILE));

      try {
        await axios.post(`${GOFILE_API}/uploadFile`, form, {
          headers: form.getHeaders(),
        });
        console.log(`✅ File ${fileId} touched successfully`);
      } catch (uploadErr) {
        console.error(`⚠️ Failed to touch file ${fileId}:`, uploadErr.message);
      }
    }

    res.status(200).json({ message: "Online ping processed and files touched" });
  } catch (err) {
    console.error("❌ Error touching Gofile files:", err.message);
    res.status(500).json({ error: "Failed to touch files" });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
