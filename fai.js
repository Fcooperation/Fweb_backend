// fai.js
import fetch from "node-fetch";

// 🔑 Your OpenRouter API Key
const OPENROUTER_API_KEY = "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";

// 🧠 Fetch FAI response + related links
export async function fetchFAI(query) {
  if (!query) throw new Error("No query provided to FAI");

  try {
    // 1️⃣ Call OpenRouter AI
    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`
      },
      body: JSON.stringify({
        // If OpenRouter rejects missing model, fallback to DeepSeek
        model: "deepseek/deepseek-chat",
        messages: [
          { role: "system", content: "You are FAI, a concise helpful assistant." },
          { role: "user", content: query }
        ]
      })
    });

    const rawText = await aiRes.text();
    console.log("🔍 Raw AI response:", rawText);

    let aiData;
    try {
      aiData = JSON.parse(rawText);
    } catch {
      aiData = {};
    }

    const answer = aiData?.choices?.[0]?.message?.content?.trim() || "No AI response available";

    // 2️⃣ Build fallback links (Google as source)
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
