// index.js
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const app = express();

const token = "e1LOiRxizCSLqTmyZ27AeZuN10qu0wfO"; // Your Gofile token
const GOFILE_API = "https://api.gofile.io";

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Fserver backend is live!");
});

app.post("/online", async (req, res) => {
  const ip = req.ip;
  const time = new Date().toISOString();
  console.log(`✅ User online: ${ip} at ${time}`);

  try {
    const rootResp = await axios.get(`${GOFILE_API}/getAccountDetails?token=${token}`);
    const folders = rootResp.data.data.rootFolder.contents || {};

    const allFiles = [];

    // Fetch all files from all folders
    for (const folderId in folders) {
      const folderMeta = folders[folderId];
      if (folderMeta.type !== "folder") continue;

      const folderContentResp = await axios.get(`${GOFILE_API}/getContent?contentId=${folderMeta.id}&token=${token}`);
      const files = folderContentResp.data.data.contents;

      for (const fileId in files) {
        const file = files[fileId];
        if (file.type === "file") {
          allFiles.push({
            fileId: file.id,
            directLink: file.link,
            name: file.name,
            date: file.createdAt
          });
        }
      }
    }

    // Sort files by date (oldest first)
    allFiles.sort((a, b) => a.date - b.date);

    // Touch every file by downloading 1 byte
    for (const file of allFiles) {
      try {
        await axios.get(file.directLink, {
          headers: { Range: "bytes=0-0" },
          responseType: "arraybuffer",
        });
        console.log(`🟢 Touched file: ${file.name}`);
      } catch (err) {
        console.warn(`🔴 Could not touch ${file.name}: ${err.response?.status || err.message}`);
      }
    }

    res.status(200).json({ message: "Files touched successfully." });
  } catch (error) {
    console.error("❌ Error touching Gofile files:", error.message);
    res.status(500).json({ error: "Failed to update files." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
