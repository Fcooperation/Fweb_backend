// fai.js
import fetch from "node-fetch";

// Replace with your actual DeepSeek API key
const DEEPSEEK_API_KEY = "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";

/**
 * Fetches FAI response and related links for a query.
 * Returns an object:
 * {
 *   answer: "<HTML or structured text for top AI response>",
 *   links: [
 *     { title, url, snippet, favicon }
 *   ]
 * }
 */
export async function fetchFAI(query) {
  if (!query) throw new Error("No query provided to FAI");

  try {
    // ===== 1️⃣ Call DeepSeek AI endpoint =====
    const aiResponse = await fetch("https://api.deepseek.ai/v1/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        mode: "concise", // or "detailed"
        max_results: 1
      })
    });

    const aiData = await aiResponse.json();
    const answer = aiData?.response?.text || "No AI response available";

    // ===== 2️⃣ Call DeepSeek search/links endpoint =====
    const linksResponse = await fetch("https://api.deepseek.ai/v1/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        max_results: 6 // number of Fcards
      })
    });

    const linksData = await linksResponse.json();

    const links = (linksData?.results || []).map(item => ({
      title: item.title || item.url,
      url: item.url,
      snippet: item.snippet || "",
      favicon: item.favicon || `https://www.google.com/s2/favicons?sz=64&domain_url=${item.url}`
    }));

    return { answer, links };

  } catch (err) {
    console.error("❌ FAI fetch error:", err.message);
    throw new Error("Failed to fetch FAI data");
  }
}
