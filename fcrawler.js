// fcrawler.js
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { downloadImage } from "./utils.js"; // your image downloader

const visited = new Set();
const maxDepth = 2;

export async function crawlSite(startUrl) {
  visited.clear();
  const siteData = { pages: [] };
  await crawlPage(startUrl, 0, siteData);
  return generateHtml(siteData);
}

async function crawlPage(url, depth, siteData) {
  if (visited.has(url) || depth > maxDepth) return;
  visited.add(url);

  try {
    const response = await axios.get(url, { headers: { "User-Agent": "FwebCrawler/1.0" }, timeout: 10000 });
    const html = response.data;
    const $ = cheerio.load(html);

    let isJsRendered = $("p, h1, h2, h3, h4, h5, h6, li").length === 0;
    const pageInfo = { url, depth, html: "", links: [] };

    if (isJsRendered) {
      // JS-rendered page: only keep the link
      pageInfo.html = `<p>JS-rendered content, see <a href="${url}" target="_blank">${url}</a></p>`;
      siteData.pages.push(pageInfo);
      return;
    }

    // Download images and rewrite src
    const imgs = $("img");
    for (const img of imgs.toArray()) {
      let src = $(img).attr("src");
      if (!src) continue;
      try {
        const absUrl = new URL(src, url).href;
        const filename = path.basename(absUrl.split("?")[0]);
        const localPath = path.join("images", filename);
        await downloadImage(absUrl, localPath);
        $(img).attr("src", localPath);
      } catch {
        continue;
      }
    }

    pageInfo.html = $.html();
    siteData.pages.push(pageInfo);

    // Follow links recursively
    const links = $("a[href]").map((_, el) => $(el).attr("href")).get();
    for (const link of links) {
      try {
        const absoluteUrl = new URL(link, url).href;
        pageInfo.links.push(absoluteUrl);
        await crawlPage(absoluteUrl, depth + 1, siteData);
      } catch {}
    }

  } catch (err) {
    console.error(`Failed to crawl ${url}:`, err.message);
  }
}

function generateHtml(siteData) {
  // Combine all pages into one HTML file for frontend
  let html = "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Crawled Site</title></head><body>";
  for (const page of siteData.pages) {
    html += `<section><h2>Page: ${page.url}</h2>${page.html}<p>Links:</p><ul>`;
    for (const link of page.links) {
      html += `<li><a href="${link}" target="_blank">${link}</a></li>`;
    }
    html += "</ul></section><hr/>";
  }
  html += "</body></html>";
  return html;
}
