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

// Function to call Arli AI with retry for concurrency limit
async function askArli(prompt, retries = 5) {
  // Wait until the previous request finishes
  while (isBusy) {
    await new Promise(res => setTimeout(res, 2000)); // wait 2s
  }
  isBusy = true;

  try {
    for (let attempt = 1; attempt <= retries; attempt++) {
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

      // If concurrency error, wait and retry
      if (data.message?.includes("can only make 1 requests at a time")) {
        console.log(`Concurrency limit hit for prompt: "${prompt}", retrying in 2s (attempt ${attempt})...`);
        await new Promise(res => setTimeout(res, 2000));
      } else {
        console.log(`Prompt: "${prompt}"\nArli Response:`, data);
        break;
      }
    }
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
