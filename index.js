// fcrawler.js
const axios = require('axios');
const cheerio = require('cheerio');
const robotsParser = require('robots-parser');
const { writeFileSync, existsSync, mkdirSync } = require('fs');
const path = require('path');
const { uploadToMega, uploadThumbnail } = require('./megaUploader'); // your custom MEGA uploader
const { generateThumbnail } = require('./thumbnailGen'); // your custom thumbnail generator
const { getFileSize, getFileType, isMediaFile } = require('./utils'); // your file helper functions

const visited = new Set();
const queue = [];
const searchIndex = [];

let robotsCache = {};

async function isAllowed(url) {
  const { origin } = new URL(url);
  if (!robotsCache[origin]) {
    try {
      const res = await axios.get(origin + '/robots.txt');
      robotsCache[origin] = robotsParser(origin + '/robots.txt', res.data);
    } catch {
      robotsCache[origin] = robotsParser(origin + '/robots.txt', '');
    }
  }
  return robotsCache[origin].isAllowed(url, 'fcrawler');
}

function isWikipediaAPIConvertible(url) {
  return url.includes('wikipedia.org/wiki/Special:');
}

function convertToWikipediaAPI(url) {
  const title = decodeURIComponent(url.split('Special:')[1]);
  return `https://en.wikipedia.org/w/api.php?action=query&format=json&list=${title.toLowerCase()}&origin=*`;
}

async function crawl(url, depth = 0) {
  if (visited.has(url) || depth > 2) return;
  visited.add(url);

  const allowed = await isAllowed(url);
  if (!allowed) {
    console.log(`🚫 Disallowed by robots.txt: ${url}`);

    if (isWikipediaAPIConvertible(url)) {
      const fallback = convertToWikipediaAPI(url);
      console.log(`🔁 Fallback to API: ${fallback}`);
      try {
        const res = await axios.get(fallback);
        const fileName = `wikiapi_${Date.now()}.json`;
        const filePath = path.join(__dirname, 'data', fileName);
        if (!existsSync('data')) mkdirSync('data');
        writeFileSync(filePath, JSON.stringify(res.data, null, 2));
        await uploadToMega(filePath, fileName);
        searchIndex.push({ title: url, url, filename: fileName, type: 'api-json' });
        console.log(`📤 Uploaded fallback API result: ${fileName}`);
      } catch (err) {
        console.log(`⚠️ Failed fallback API fetch: ${fallback}`);
      }
    }
    return;
  }

  let res;
  try {
    res = await axios.get(url);
  } catch {
    console.log(`❌ Failed to fetch: ${url}`);
    return;
  }

  const contentType = res.headers['content-type'];
  if (isMediaFile(contentType)) {
    const fileSize = parseInt(res.headers['content-length'] || '0');
    if (fileSize < 100 * 1024 * 1024) {
      const ext = getFileType(url);
      const fileName = `media_${Date.now()}.${ext}`;
      const filePath = path.join(__dirname, 'media', fileName);
      if (!existsSync('media')) mkdirSync('media');
      const fileData = await axios({ url, responseType: 'stream' });
      const writer = require('fs').createWriteStream(filePath);
      fileData.data.pipe(writer);
      writer.on('finish', async () => {
        await uploadToMega(filePath, fileName);
        const thumb = await generateThumbnail(filePath);
        await uploadThumbnail(thumb);
        searchIndex.push({ title: url, url, filename: fileName, type: 'media' });
        console.log(`📤 Uploaded media file: ${fileName}`);
      });
    }
    return;
  }

  const $ = cheerio.load(res.data);
  const title = $('title').text().trim();
  const blocks = [];

  $('body').find('p, h1, h2, h3, h4, h5, h6, img, ul, ol, li').each((_, el) => {
    blocks.push($.html(el));
  });

  const htmlContent = `
    <html>
    <head><title>${title}</title></head>
    <body>${blocks.join('\n')}</body>
    </html>
  `;

  const fileName = `page_${Date.now()}.html`;
  const filePath = path.join(__dirname, 'pages', fileName);
  if (!existsSync('pages')) mkdirSync('pages');
  writeFileSync(filePath, htmlContent);
  await uploadToMega(filePath, fileName);
  searchIndex.push({ title, url, filename: fileName, type: 'html' });

  console.log(`📤 Uploaded: ${url}`);

  // Enqueue links
  $('a[href]').each((_, el) => {
    const link = $(el).attr('href');
    if (link.startsWith('http')) queue.push(link);
    else if (link.startsWith('/')) {
      try {
        const abs = new URL(link, url).href;
        queue.push(abs);
      } catch {}
    }
  });
}

(async () => {
  const startURL = 'https://en.wikipedia.org/wiki/Category:Reference';
  queue.push(startURL);

  while (queue.length) {
    const next = queue.shift();
    await crawl(next);
  }

  // Save index
  writeFileSync('search_index.json', JSON.stringify(searchIndex, null, 2));
  console.log(`✅ Saved search_index.json with ${searchIndex.length} entries.`);
})();
