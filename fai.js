// fai.js
import fetch from "node-fetch";

// Replace with your OpenRouter API key
const OPENROUTER_API_KEY = "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";

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
    // ===== 1️⃣ Call OpenRouter DeepSeek model =====
    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat",
        messages: [
          { role: "system", content: "You are a helpful AI for Fweb search results." },
          { role: "user", content: query }
        ]
      })
    });

    const aiData = await aiResponse.json();
    const answer =
      aiData?.choices?.[0]?.message?.content || "No AI response available";

    // ===== 2️⃣ (Placeholder) Links – since OpenRouter doesn’t return search links =====
    // For now, we return empty links or mock Google links
    const links = [
      {
        title: "Search more on Google",
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        snippet: "See additional results on Google.",
        favicon: "https://www.google.com/favicon.ico",
      }
    ];

    return { answer, links };
  } catch (err) {
    console.error("❌ FAI fetch error:", err.message);
    throw new Error("Failed to fetch FAI data");
  }
}
