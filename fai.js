import "dotenv/config";

const MODELS = [
  "gemini-2.5-flash",
  "gemini-3.5-flash",
  "gemini-3-flash-preview"
];

export async function fetchFAI({ userId, messages = [], prompt }) {

  const API_KEY = process.env.GEMINI_API_KEY;

  // convert chat history into readable text
  const context = messages
    .slice(-15) // extra safety
    .map(m => {
      const role = m.role === "ai" ? "Assistant" : "User";
      return `${role}: ${m.text}`;
    })
    .join("\n");

  for (const model of MODELS) {
    try {

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": API_KEY
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `
You are FAI, a helpful study assistant inside the FCOOPERATION AI system.

RULES:
- Do NOT introduce yourself unless asked
- Do NOT repeat "I am FAI"
- Answer naturally and directly
- Be short, clear, and student-friendly
- If user asks for explanation, break it down simply

User ID: ${userId}

Conversation history:
${context}

Current user message:
${prompt}
                    `.trim()
                  }
                ]
              }
            ]
          })
        }
      );

      const data = await res.json();

      console.log(
        `FAI RAW (${model}):`,
        JSON.stringify(data, null, 2)
      );

      const answer =
        data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (answer) {
        return {
          answer,
          model,
          userId
        };
      }

    } catch (err) {
      console.error(`❌ FAI ERROR (${model}):`, err.message);
    }
  }

  return {
    answer: "FAI failed to respond. Please try again.",
    model: null,
    userId
  };
                    }
