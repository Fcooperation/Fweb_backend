// fai.js
import fetch from "node-fetch";

// Replace with your actual OpenRouter API key
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
    // ===== 1️⃣ Call OpenRouter DeepSeek chat model =====
    const aiResponse = await fetch("https://openrouter.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: query }
        ],
        stream: false
      })
    });

    const aiData = await aiResponse.json();

    // Extract AI answer
    const answer = aiData?.choices?.[0]?.message?.content || "No AI response available";

    // ===== 2️⃣ Create fallback links (Fcards) =====
    // OpenRouter DeepSeek doesn’t provide search results directly, so we fallback to Google
    const links = [
      {
        title: `Search more on Google`,
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        snippet: `See additional results on Google.`,
        favicon: `https://www.google.com/favicon.ico`
      }
    ];

    return { answer, links };

  } catch (err) {
    console.error("❌ FAI fetch error:", err.message);
    // Always return fallback Google link if something fails
    return {
      answer: "No AI response available",
      links: [
        {
          title: `Search more on Google`,
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          snippet: `See additional results on Google.`,
          favicon: `https://www.google.com/favicon.ico`
        }
      ]
    };
  }
}
