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

  // ❌ If no userId, do nothing
  if (!userId) {
    return {
      answer: "Guest mode: memory disabled.",
      model: null,
      userId: null
    };
  }

  // ------------------------------
  // 1. GET USER MEMORY
  // ------------------------------
  let userMemory = {};

  try {
    const { data } = await supabase
      .from("fai_memory")
      .select("memory")
      .eq("user_id", userId)
      .single();

    if (data?.memory) {
      userMemory = data.memory;
    }

  } catch (err) {
    console.log("⚠️ Memory fetch error:", err.message);
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
  // 3. BUILD MEMORY STRING
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
      // 5. UPDATE MEMORY (SIMPLE AUTO UPDATE)
      // ------------------------------
      const updatedMemory = await generateMemoryUpdate({
        userId,
        prompt,
        answer,
        oldMemory: userMemory
      });

      if (updatedMemory) {
        await supabase
          .from("fai_memory")
          .upsert({
            user_id: userId,
            memory: updatedMemory
          });
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
async function generateMemoryUpdate({ userId, prompt, answer, oldMemory }) {

  const API_KEY = process.env.GEMINI_API_KEY;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
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
If nothing important changed, return {}.

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

    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {
      return null;
    }

  } catch (err) {
    console.log("⚠️ Memory update error:", err.message);
    return null;
  }
        }
