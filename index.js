// index.js import express from 'express'; import axios from 'axios'; import * as cheerio from 'cheerio'; import cors from 'cors'; import fs from 'fs'; import path from 'path'; import { getAnswer } from './fAi.js';

const app = express(); const PORT = process.env.PORT || 3000; app.use(cors()); app.use(express.json());

// Gofile credentials const GOFILE_TOKEN = 'e1LOiRxizCSLqTmyZ27AeZuN10qu0wfO'; const GOFILE_ACCOUNT_ID = 'd8658556-dc3a-4572-a73e-b52df41d60cc'; let currentFolder = null; let currentFolderSize = 0;

function detectCategories(htmlText) { const categories = []; const lower = htmlText.toLowerCase(); if (lower.includes('forum') || lower.includes('discussion')) categories.push('forums'); if (lower.includes('news') || lower.includes('breaking') || lower.includes('headline')) categories.push('news'); if (lower.includes('book') || lower.includes('novel') || lower.includes('published')) categories.push('books'); return categories; }

async function getImagesAndCategories(wikiUrl) { try { const htmlRes = await axios.get(wikiUrl); const $ = cheerio.load(htmlRes.data); const rawText = $('body').text(); const categories = detectCategories(rawText); const images = []; $('#mw-content-text img').each((_, el) => { if (images.length >= 20) return; const src = $(el).attr('src') || ''; if (src && !src.includes('icon') && !src.includes('logo') && !src.includes('wikimedia-button')) { const fullSrc = src.startsWith('http') ? src : https:${src}; images.push(fullSrc); } }); return { rawText, images, categories }; } catch (err) { console.error(❌ Error scraping article: ${err.message}); return { rawText: '', images: [], categories: [] }; } }

async function ensureFolder() { if (currentFolder && currentFolderSize < 9500 * 1024 * 1024) return currentFolder; try { const res = await axios.get(https://api.gofile.io/createFolder?token=${GOFILE_TOKEN}); const folder = res.data.data.id; currentFolder = folder; currentFolderSize = 0; return folder; } catch (err) { console.error('❌ Error creating Gofile folder:', err.message); return null; } }

async function uploadToGofile(dataObj) { try { const folder = await ensureFolder(); if (!folder) return;

const filename = `fAi_${Date.now()}.json`;
const filePath = path.join('/tmp', filename);
fs.writeFileSync(filePath, JSON.stringify(dataObj, null, 2));

const form = new FormData();
form.append('file', fs.createReadStream(filePath));
form.append('folderId', folder);
form.append('token', GOFILE_TOKEN);

const uploadRes = await axios.post('https://api.gofile.io/uploadFile', form, {
  headers: form.getHeaders()
});

const uploadedSize = fs.statSync(filePath).size;
currentFolderSize += uploadedSize;
fs.unlinkSync(filePath);

} catch (err) { console.error('❌ Upload to Gofile failed:', err.message); } }

app.post('/search', async (req, res) => { const { query } = req.body; if (!query) return res.status(400).json({ error: 'Missing query.' });

const aiData = await getAnswer(query); if (!aiData) { return res.json({ response: ❌ Couldn't find anything for "${query}", related: [], images: [], categories: [], source: null }); }

const { rawText, images, categories } = await getImagesAndCategories(aiData.source);

const payload = { query, title: aiData.title, answer: aiData.main, source: aiData.source, images, categories, rawText, timestamp: new Date().toISOString() };

uploadToGofile(payload); // 🚀 Auto-upload result

res.json({ response: aiData.main, related: [], images, title: aiData.title, source: aiData.source, categories }); });

app.listen(PORT, () => { console.log(🚀 Fserver running on port ${PORT}); });

