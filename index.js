const axios = require("axios");
const fs = require("fs");
const path = require("path");

const API_TOKEN = "e1LOiRxizCSLqTmyZ27AeZuN10qu0wfO"; // Replace this with your real token

// Helper: Sleep for delay
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// Get user's root folder and all subfolders/files recursively
async function getAllFiles(folderId, files = []) {
  try {
    const res = await axios.get(`https://api.gofile.io/getContent?contentId=${folderId}&token=${API_TOKEN}&websiteToken=`);
    const contents = res.data.data.contents;
    if (!contents) return files;

    for (const id in contents) {
      const item = contents[id];
      if (item.type === "folder") {
        await getAllFiles(item.id, files);
      } else if (item.type === "file") {
        files.push({
          id: item.id,
          name: item.name,
          directLink: item.link,
          size: item.size,
          date: item.createdAt
        });
      }
    }

    return files;
  } catch (err) {
    console.error(`❌ Error listing folder ${folderId}:`, err.response?.data?.message || err.message);
    return files;
  }
}

// Download 1 byte from each file to refresh expiry
async function touchFile(file) {
  try {
    const res = await axios.get(file.directLink, {
      headers: { Range: "bytes=0-0" }, // Only get the first byte
      responseType: "stream",
    });

    console.log(`✅ Refreshed: ${file.name} (${file.id})`);
  } catch (err) {
    console.warn(`⚠️ Skipped (error or deleted): ${file.name} (${file.id}) - ${err.response?.status || err.message}`);
  }
}

async function main() {
  console.log("📁 Fetching root folder...");

  // Step 1: Get your account details
  let rootFolder;
  try {
    const accountRes = await axios.get(`https://api.gofile.io/getAccountDetails?token=${API_TOKEN}`);
    rootFolder = accountRes.data.data.rootFolder;
  } catch (err) {
    console.error("❌ Failed to get root folder:", err.response?.data?.message || err.message);
    return;
  }

  console.log("🔍 Scanning all files...");
  const allFiles = await getAllFiles(rootFolder);

  // Sort from oldest to newest
  allFiles.sort((a, b) => a.date - b.date);

  console.log(`🔁 Refreshing ${allFiles.length} files...`);
  for (const file of allFiles) {
    await touchFile(file);
    await delay(100); // Light delay to avoid hitting rate limits
  }

  console.log("✅ Done refreshing all file timers!");
}

main();
