import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import FormData from 'form-data';
import fs from 'fs';
import cors from 'cors';
import { getAnswer } from './fAi.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

function cleanFileName(title) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '-') + '.txt';
}

async function uploadToGofile(filePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));

  const res = await axios.post('https://api.gofile.io/uploadFile', form, {
    headers: form.getHeaders(),
  });

  return res.data.data.downloadPage;
}

async function getTextFromURL(url, title) {
  try {
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    const bodyText = $('body').text().trim();

    const filePath = `./uploads/${cleanFileName(title)}`;
    fs.writeFileSync(filePath, bodyText);

    return filePath;
  } catch (err) {
    console.error('❌ Error scraping page:', err.message);
    return null;
  }
}

app.post('/search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Missing query.' });

  const aiData = await getAnswer(query);
  if (!aiData) {
    return res.json({ response: `No answer for "${query}"`, images: [], source: null });
  }

  const textFilePath = await getTextFromURL(aiData.source, aiData.title);
  let gofileUrl = null;

  if (textFilePath) {
    gofileUrl = await uploadToGofile(textFilePath);
  }

  res.json({
    response: aiData.main,
    source: aiData.source,
    uploadedTo: gofileUrl,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 fServer running on port ${PORT}`);
});
