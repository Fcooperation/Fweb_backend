// fai.js
import axios from "axios";

// Replace with your DeepSeek/OpenRouter API key
const DEEPSEEK_API_KEY = "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";

// Function to generate AI response and Fcards
export async function handleFAI(query) {
  if (!query) throw new Error("No query provided for FAI");

  try {
    // 1️⃣ AI-generated response
    const aiResponse = await axios.post(
      "https://openrouter.ai/api/v1/responses",
      {
        model: "deepseek-r1:free",
        input: `You are an intelligent search assistant. Analyze this search query and give a structured, informative, accurate, and well-formatted response, suitable to display at the top of search results:\n"${query}"`,
      },
      {
        headers: {
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const aiText = aiResponse.data.output?.[0]?.content?.[0]?.text || "No AI response";

    // 2️⃣ Generate Fcards (dummy example — replace with real search/crawler logic)
    // Here, you could integrate your fcrawler.js or call your search API
    const fcards = [
      {
        title: `Example link for "${query}"`,
        url: "https://example.com",
        snippet: `This is a snippet describing the content of "${query}"`,
        favicon: "https://www.google.com/s2/favicons?sz=64&domain_url=https://example.com",
        type: "link"
      },
      {
        title: `Another example for "${query}"`,
        url: "https://example.org",
        snippet: "Another snippet for demonstration purposes",
        favicon: "https://www.google.com/s2/favicons?sz=64&domain_url=https://example.org",
        type: "link"
      }
    ];

    return { aiText, fcards };
  } catch (err) {
    console.error("❌ FAI error:", err.message);
    throw new Error("FAI request failed");
  }
}
