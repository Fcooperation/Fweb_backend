// fai.js
import fetch from "node-fetch";

// Replace with your OpenRouter API key (the one that worked ✅)
const OPENROUTER_API_KEY = "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";

/**
 * Fetches AI response + generates related links for Fcards
 * Returns:
 * {
 *   answer: "AI’s response...",
 *   links: [ { title, url, snippet, favicon } ]
 * }
 */
export async function fetchFAI(query) {
  if (!query) throw new Error("No query provided to FAI");

  try {
    // ===== 1️⃣ Call OpenRouter =====
    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat", // the one that worked
        messages: [
          { role: "system", content: "You are a helpful assistant that gives concise answers." },
          { role: "user", content: query }
        ],
        stream: false
      })
    });

    const aiData = await aiResponse.json();
    console.log("🔍 Raw AI response:", JSON.stringify(aiData));

    const answer = aiData?.choices?.[0]?.message?.content || "No AI response available";

    // ===== 2️⃣ Generate Fcards links =====
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
      answer: "No AI response available",
      links: [
        {
          title: "Search more on Google",
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          snippet: "See additional results on Google.",
          favicon: "https://www.google.com/favicon.ico"
        }
      ]
    };
  }
}
