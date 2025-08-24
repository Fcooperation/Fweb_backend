import fetch from "node-fetch";

// Your Arli AI API key
const API_KEY = "9aa52f54-cad1-4200-9299-015926f1c3e6";

// Example test prompt
const prompt = "Hello Arli, can you summarize this test message?";

async function testArli() {
  try {
    const response = await fetch("https://api.arliai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "arliai-gpt-1",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 100
      })
    });

    const data = await response.json();
    console.log("Arli API Response:", data);
  } catch (error) {
    console.error("Error calling Arli API:", error);
  }
}

testArli();
