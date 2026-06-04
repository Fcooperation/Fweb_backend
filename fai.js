import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const MODELS = [
  "gemini-2.5-flash",
  "gemini-3.5-flash",
  "gemini-3-flash-preview"
];

// ------------------------------
// Supabase setup
// ------------------------------
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// ------------------------------
// MAIN FUNCTION
// ------------------------------
export async function fetchFAI({ userId, messages = [], prompt }) {

  const API_KEY = process.env.GEMINI_API_KEY;

  // ------------------------------
  // SAFE DEFAULT MEMORY
  // ------------------------------
  let userMemory = {};

  // ------------------------------
  // 1. LOAD MEMORY ONLY IF USER EXISTS
  // ------------------------------
  if (userId) {
    const { data, error } = await supabase
      .from("fai_memory")
      .select("memory")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.log("⚠️ Supabase fetch error:", error.message);
    }

    userMemory = data?.memory || {};
  }

  // ------------------------------
  // 2. FORMAT CHAT HISTORY
  // ------------------------------
  const context = messages
    .slice(-15)
    .map(m => {
      const role = m.role === "ai" ? "Assistant" : "User";
      return `${role}: ${m.text}`;
    })
    .join("\n");

  // ------------------------------
  // 3. MEMORY STRING
  // ------------------------------
  const memoryText = JSON.stringify(userMemory, null, 2);

  // ------------------------------
  // 4. CALL GEMINI
  // ------------------------------
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
- Be natural, helpful, and student-friendly
- Use memory when relevant

USER MEMORY:
${memoryText}

CHAT HISTORY:
${context}

USER MESSAGE:
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

      const answer =
        data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!answer) continue;

      // ------------------------------
      // 5. UPDATE MEMORY ONLY IF userId EXISTS
      // ------------------------------
      if (userId) {

        const updatedMemory = await generateMemoryUpdate({
          userId,
          prompt,
          answer,
          oldMemory: userMemory
        });

        if (updatedMemory) {
          const { error } = await supabase
  .from("fai_memory")
  .update({
    memory: updatedMemory
  })
  .eq("user_id", userId);

          if (error) {
            console.log("❌ Supabase save error:", error.message);
          }
        }
      }

      return {
        answer,
        model,
        userId
      };

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

// ------------------------------
// MEMORY UPDATE GENERATOR
// ------------------------------

    async function generateMemoryUpdate({
  userId,
  prompt,
  answer,
  oldMemory
}) {

  const API_KEY = process.env.GEMINI_API_KEY;

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
Extract important user facts ONLY.

Old Memory:
${JSON.stringify(oldMemory)}

User said:
${prompt}

AI responded:
${answer}

Return ONLY valid JSON.

If nothing important changed:
{}

Focus on:
- name
- interests
- preferences
- projects
- study topics
                    `.trim()
                  }
                ]
              }
            ]
          })
        }
      );

      const data = await res.json();

      const text =
  data?.candidates?.[0]?.content?.parts?.[0]?.text;

if (!text) continue;

try {

  console.log("🧠 RAW MEMORY RESPONSE:", text);

  const cleanText = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const newMemory = JSON.parse(cleanText);

  // Don't save empty updates
  if (Object.keys(newMemory).length === 0) {
    return null;
  }

  return {
    ...oldMemory,
    ...newMemory
  };

} catch (err) {

  console.log(
    `⚠️ Memory JSON parse failed (${model}):`,
    err.message
  );

}

    } catch (err) {

      console.log(
        `⚠️ Memory model failed (${model}):`,
        err.message
      );

    }

  }

  return null;
    }
       }
