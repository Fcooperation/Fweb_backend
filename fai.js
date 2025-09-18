// fai.js
import fetch from "node-fetch";

const HF_API_KEY = process.env.HF_API_KEY; // Set this in Render or your environment
const MODEL = "EleutherAI/gpt-neo-2.7B";

/**
 * Fetch AI-generated answer + Google-like Fcards links
 * @param {string} query
 * @returns {Promise<{answer: string, links: Array<{title:string,url:string,favicon:string}>}>}
 */
export async function fetchFAI(query) {
  if (!query) throw new Error("❌ No query provided to FAI");

  try {
    // 1️⃣ Call Hugging Face Inference API
    const response = await fetch(`https://api-inference.huggingface.co/models/${MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: query }),
    });

    if (!response.ok) {
      throw new Error(`HF API error ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();

    // Some Hugging Face outputs have different structures
    const answer =
      result[0]?.generated_text ||
      result.generated_text ||
      JSON.stringify(result);

    // 2️⃣ Build Google-like links for Fcards
    const links = [
      {
        title: `Search results for "${query}"`,
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        snippet: `See more about "${query}" on Google Search.`,
        favicon: "https://www.google.com/favicon.ico",
      },
      {
        title: `Wikipedia - ${query}`,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,
        snippet: `Learn about ${query} on Wikipedia.`,
        favicon: "https://www.wikipedia.org/static/favicon/wikipedia.ico",
      },
      {
        title: `News on ${query}`,
        url: `https://news.google.com/search?q=${encodeURIComponent(query)}`,
        snippet: `Latest news about ${query}.`,
        favicon: "https://news.google.com/favicon.ico",
      },
    ];

    return { answer, links };
  } catch (err) {
    console.error("❌ FAI fetch error:", err.message);

    // Fallback response
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
