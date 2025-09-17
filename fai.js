// fai.js
import OpenAI from "openai";

// 🔑 Hardcoded OpenRouter API key
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: "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",
  defaultHeaders: {
    "HTTP-Referer": "https://fweb-omega.vercel.app", // your site URL
    "X-Title": "Fweb", // your site title
  },
});

/**
 * Fetches AI answer + Google-like links for Fcards.
 * @param {string} query
 * @returns {Promise<{answer: string, links: Array}>}
 */
export async function fetchFAI(query) {
  if (!query) throw new Error("❌ No query provided to FAI");

  try {
    // ===== 1️⃣ Ask AI (OpenRouter) =====
    const completion = await openai.chat.completions.create({
      model: "openai/gpt-4o", // can swap with deepseek/deepseek-chat
      messages: [{ role: "user", content: query }],
    });

    const aiAnswer =
      completion.choices[0]?.message?.content?.trim() ||
      "No AI response available";

    // ===== 2️⃣ Build Google-like links for Fcards =====
    const links = [
      {
        title: `Search results for "${query}"`,
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        snippet: `See more about "${query}" on Google Search.`,
        favicon: "https://www.google.com/favicon.ico",
      },
      {
        title: "Wikipedia",
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,
        snippet: `Learn about ${query} on Wikipedia.`,
        favicon:
          "https://www.google.com/s2/favicons?sz=64&domain_url=https://en.wikipedia.org",
      },
      {
        title: "Britannica",
        url: `https://www.britannica.com/search?query=${encodeURIComponent(
          query
        )}`,
        snippet: `Explore Britannica articles about ${query}.`,
        favicon:
          "https://www.google.com/s2/favicons?sz=64&domain_url=https://www.britannica.com",
      },
    ];

    return { answer: aiAnswer, links };
  } catch (err) {
    console.error("❌ FAI fetch error:", err.message);

    return {
      answer: "No AI response available",
      links: [
        {
          title: "Search more on Google",
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          snippet: "See additional results on Google.",
          favicon: "https://www.google.com/favicon.ico",
        },
      ],
    };
  }
}
