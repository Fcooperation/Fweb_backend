const axios = require("axios");
const path = require("path");

// CONFIG
const API_TOKEN = "e1LOiRxizCSLqTmyZ27AeZuN10qu0wfO";
const API_BASE = "https://api.gofile.io";

// Get root folder of your account
async function getRootFolder() {
  const res = await axios.get(`${API_BASE}/getAccountDetails?token=${API_TOKEN}`);
  return res.data.data.rootFolder;
}

// Find or create folder for a domain (e.g. "archive.org")
async function getOrCreateFolderForSite(siteName, parentFolderId) {
  const contentRes = await axios.get(`${API_BASE}/getContent?contentId=${parentFolderId}`);
  const folders = contentRes.data.data.contents || {};

  for (let item of Object.values(folders)) {
    if (item.type === "folder" && item.name === siteName) {
      return item.id;
    }
  }

  // Create new folder if it doesn't exist
  const newFolder = await axios.put(`${API_BASE}/createFolder`, null, {
    params: {
      token: API_TOKEN,
      parentFolderId,
      folderName: siteName
    }
  });

  return newFolder.data.data.id;
}

// Download 1 byte from each file to reset expiry timer
async function touchFilesInFolder(folderId) {
  const res = await axios.get(`${API_BASE}/getContent?contentId=${folderId}`);
  const items = res.data.data.contents || {};

  const files = Object.values(items).filter(i => i.type === "file");

  // Sort oldest to newest
  files.sort((a, b) => new Date(a.creationDate) - new Date(b.creationDate));

  for (let file of files) {
    try {
      const url = file.link;
      const response = await axios.get(url, {
        headers: { Range: "bytes=0-0" },
        timeout: 10000,
      });
      console.log(`✅ Touched ${file.name}`);
    } catch (err) {
      console.warn(`⚠️ Failed to touch ${file.name}: ${err.message}`);
    }
  }
}

// MAIN
(async () => {
  try {
    const rootFolderId = await getRootFolder();
    const siteDomain = "archive.org"; // change to your domain or make dynamic
    const siteFolderId = await getOrCreateFolderForSite(siteDomain, rootFolderId);

    console.log(`📁 Folder for ${siteDomain}: ${siteFolderId}`);
    await touchFilesInFolder(siteFolderId);
    console.log("✅ All files touched.");
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
})();
