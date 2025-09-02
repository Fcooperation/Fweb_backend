// fcrawler.js
import axios from "axios";
import * as cheerio from "cheerio";

// Function to handle search/crawling
export async function handleSearch(query) {
const isLink = /^https?://|^[\w-]+.[a-z]{2,}/i.test(query);

if (!isLink) {
return [
{
title: "Normal Search Ignored",
url: null,
snippet: "Normal text queries are not yet supported.",
html: null
}
];
}

// Normalize link
const url = query.startsWith("http") ? query : "https://" + query;

try {
// Fetch page
const response = await axios.get(url, {
headers: {
"User-Agent": "FwebCrawler/1.0 (+https://fweb.africa)"
},
timeout: 10000
});

const html = response.data;        
    
// Load HTML into cheerio        
const $ = cheerio.load(html);        
    
// Extract text blocks (e.g. paragraphs, headings, list items)        
let blocks = [];        
$("p, h1, h2, h3, h4, h5, h6, li").each((_, el) => {        
  const text = $(el).text().trim();        
  if (text.length > 30) { // ignore very short fragments        
    blocks.push(text);        
  }        
});        
    
// If no blocks → probably blocked by JS        
if (blocks.length === 0) {        
  return [        
    {        
      title: "Blocked by JS",        
      url,        
      snippet: "This site requires JavaScript and cannot be crawled with static HTML.",        
      html: null        
    }        
  ];        
}        
    
// ✅ Return both summary + raw HTML        
return [        
  {        
    title: "Done Crawling",        
    url,        
    snippet: `Captured ${blocks.length} content blocks from the page.`,        
    html // raw html sent back to frontend        
  }        
];

} catch (err) {
console.error("❌ Crawl error:", err.message);

if (err.response && err.response.status === 403) {        
  return [        
    {        
      title: "Blocked by Robots",        
      url,        
      snippet: "Access to this page was forbidden (robots.txt or server block).",        
      html: null        
    }        
  ];        
}        
    
return [        
  {        
    title: "Crawl Failed",        
    url,        
    snippet: err.message,        
    html: null        
  }        
];

}
}
