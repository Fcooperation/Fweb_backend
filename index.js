import fetch from "node-fetch";

// Your Arli AI API key
const API_KEY = "9aa52f54-cad1-4200-9299-015926f1c3e6";

// Example test prompts
const prompts = [
  "Hello Arli, can you summarize this test message?",
  "Give me a short joke.",
  "Explain Node.js in simple terms."
];

// Simple queue mechanism
let isBusy = false;

async function askArli(prompt) {
  // Wait until the previous request finishes
  while (isBusy) {
    await new Promise(res => setTimeout(res, 100)); // wait 100ms
  }
  isBusy = true;

  try {
    const response = await fetch("https://api.arliai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "Gemma-3-27B-it",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 100
      })
    });

    const data = await response.json();
    console.log(`Prompt: "${prompt}"\nArli Response:`, data);
  } catch (error) {
    console.error("Error calling Arli API:", error);
  } finally {
    isBusy = false; // Mark request finished
  }
}

// Function to run all prompts sequentially
async function runTestQueue() {
  for (const prompt of prompts) {
    await askArli(prompt); // ensures one at a time
  }
}

runTestQueue();
