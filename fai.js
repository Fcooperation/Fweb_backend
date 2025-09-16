// fai.js
import fetch from "node-fetch";

// ⚠️ Use your actual OpenRouter API key
const OPENROUTER_API_KEY = "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";

/**
 * Fetches FAI response and related links for a query.
 * Returns an object:
 * {
 *   answer: "<AI response text>",
 *   links: [
 *     { title, url, snippet, favicon }
 *   ]
 * }
 */
export async function fetchFAI(query) {
  if (!query) throw new Error("No query provided to FAI");

  try {
    // ===== 1️⃣ Call OpenRouter DeepSeek =====
    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat",
        messages: [
          { role: "system", content: "You are a helpful assistant that gives concise useful answers." },
          { role: "user", content: query }
        ]
      })
    });

    const rawText = await aiResponse.text();
    console.log("🔍 Raw AI response:", rawText);

    let aiData;
    try {
      aiData = JSON.parse(rawText);
    } catch (e) {
      throw new Error("OpenRouter returned non-JSON: " + rawText.slice(0, 200));
    }

    const answer =
      aiData?.choices?.[0]?.message?.content?.trim() ||
      "No AI response available";

    // ===== 2️⃣ Build Fcards (links to search) =====
    const links = [
      {
        title: "Search more on Google",
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        snippet: "See additional results on Google.",
        favicon: "https://www.google.com/favicon.ico"
      }
    ];

    return { answer, links };

  } catch (err) {
    console.error("❌ FAI fetch error:", err.message);
    return {
      answer: "Error fetching AI response",
      links: [
        {
          title: "Search manually on Google",
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          snippet: "See additional results on Google.",
          favicon: "https://www.google.com/favicon.ico"
        }
      ]
    };
  }
}
