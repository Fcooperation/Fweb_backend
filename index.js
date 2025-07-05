const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const GOFILE_TOKEN = 'e1LOiRxizCSLqTmyZ27AeZuN10qu0wfO';

app.use(cors());
app.use(express.json());

app.post('/search', async (req, res) => {
  const { query } = req.body;
  console.log('Received search query:', query);

  try {
    // 1. Get summary from Wikipedia API
    const summaryRes = await axios.get(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`
    );
    const summary = summaryRes.data.extract || 'No summary available.';
    const pageUrl = summaryRes.data.content_urls?.desktop?.page || null;

    // 2. Get search results from Wikipedia search API
    const searchRes = await axios.get(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json`
    );

    const searchResults = searchRes.data.query.search;

    // 3. Prepare fcards (limit to 10)
    const webResults = searchResults.slice(0, 10).map(result => ({
      title: result.title,
      snippet: result.snippet.replace(/<\/?[^>]+(>|$)/g, ""),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(result.title)}`
    }));

    // 4. Fetch 20 images related to query (using Wikimedia)
    const imageRes = await axios.get(
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=20&prop=imageinfo&iiprop=url&iiurlwidth=300&origin=*`
    );

    const pages = imageRes.data.query?.pages || {};
    const imageResults = Object.values(pages)
      .map(p => p.imageinfo?.[0]?.thumburl)
      .filter(Boolean)
      .slice(0, 20);

    // Send to frontend first
    res.json({
      sentence: summary,
      web: webResults,
      images: imageResults
    });

    // 5. Save content to a .txt and upload to Gofile
    const fileContent = `Search: ${query}\n\n${summary}\n\nLinks:\n` +
      webResults.map(item => `${item.title}: ${item.url}`).join('\n');

    const filename = `${uuidv4()}-${query}.txt`;
    const filepath = `./temp/${filename}`;
    fs.mkdirSync('./temp', { recursive: true });
    fs.writeFileSync(filepath, fileContent);

    const gofileUrl = await uploadToGofile(filepath, GOFILE_TOKEN);
    if (gofileUrl) console.log("Uploaded to Gofile:", gofileUrl);
    else console.error("Gofile upload failed");

    fs.unlinkSync(filepath); // cleanup
  } catch (err) {
    console.error("API flow error:", err.message);

    res.json({
      sentence: "Not found.",
      web: [],
      images: []
    });
  }
});

async function uploadToGofile(filePath, token) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));

  try {
    const res = await axios.post(`https://api.gofile.io/uploadFile?token=${token}`, form, {
      headers: form.getHeaders(),
      timeout: 10000
    });

    if (res.data.status === 'ok') {
      return res.data.data.downloadPage;
    } else {
      console.error("Gofile upload failed:", res.data);
      return null;
    }
  } catch (err) {
    console.error("Gofile upload error:", err.message);
    return null;
  }
}

app.listen(PORT, () => {
  console.log(`Fweb backend listening on port ${PORT}`);
});
