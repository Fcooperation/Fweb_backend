// fai.js
import fetch from "node-fetch";

const HF_API_KEY = process.env.HF_API_KEY; // use env from Render
const MODEL = "meta-llama/Llama-3-8B-Instruct";

export async function fetchFAI(query) {
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
  const answer =
    result[0]?.generated_text ||
    result.generated_text ||
    JSON.stringify(result);

  const searchLinks = [
    {
      title: `Search results for ${query}`,
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      favicon: "https://www.google.com/favicon.ico",
    },
    {
      title: `Wikipedia - ${query}`,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,
      favicon: "https://en.wikipedia.org/static/favicon/wikipedia.ico",
    },
    {
      title: `News on ${query}`,
      url: `https://news.google.com/search?q=${encodeURIComponent(query)}`,
      favicon: "https://news.google.com/favicon.ico",
    },
  ];

  return { answer, links: searchLinks };
}
