import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const MODELS = [
  // 🔥 Primary text model
  "gemini-3.5-flash",

  // ⚡ Fast fallback
  "gemini-3.1-flash-lite",

  // 🧠 Strong reasoning fallback
  "gemini-2.5-flash",

  // 🧠 Advanced reasoning fallback
  "gemini-3.1-pro-preview"
];

// 🎨 Image generation models
const IMAGE_MODELS = [
  "gemini-2.5-flash-image",
  "gemini-3.1-flash-image"
];

// ------------------------------
// Supabase setup
// ------------------------------
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// ------------------------------
// LIMIT WORDS
// ------------------------------

function limitWords(text, maxWords = 300) {

  if (!text) return "";

  const words = String(text)
    .trim()
    .split(/\s+/);

  if (words.length <= maxWords) {
    return String(text).trim();
  }

  return words
    .slice(0, maxWords)
    .join(" ") + "...";
}

// ------------------------------
// IMAGE REQUEST DETECTOR
// ------------------------------

function isImageRequest(prompt) {

  if (!prompt) return false;

  const text =
    String(prompt)
      .toLowerCase()
      .trim();

  const imagePatterns = [

    /\bgenerate\s+(an?\s+)?image\b/,
    /\bgenerate\s+(an?\s+)?picture\b/,
    /\bcreate\s+(an?\s+)?image\b/,
    /\bcreate\s+(an?\s+)?picture\b/,
    /\bmake\s+(an?\s+)?image\b/,
    /\bmake\s+(an?\s+)?picture\b/,
    /\bdraw\s+(an?\s+)?image\b/,
    /\bdraw\s+(an?\s+)?picture\b/,
    /\bdraw\s+me\b/,
    /\bshow\s+me\s+(an?\s+)?diagram\b/,
    /\bgenerate\s+(an?\s+)?diagram\b/,
    /\bcreate\s+(an?\s+)?diagram\b/,
    /\bmake\s+(an?\s+)?diagram\b/,
    /\bvisuali[sz]e\b/,
    /\bvisual\s+of\b/,
    /\billustration\s+of\b/,
    /\bgenerate\s+an?\s+illustration\b/

  ];

  return imagePatterns.some(
    pattern => pattern.test(text)
  );

}

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
// 5. RETURN ANSWER IMMEDIATELY
// ------------------------------

const response = {
  answer,
  model,
  userId
};

// ------------------------------
// UPDATE MEMORY IN BACKGROUND
// ------------------------------

if (userId) {

  generateMemoryUpdate({
    userId,
    prompt,
    answer,
    oldMemory: userMemory
  })
  .then(async updatedMemory => {

    if (!updatedMemory) return;

    const { error } = await supabase
      .from("fai_memory")
      .update({
        memory: updatedMemory
      })
      .eq("user_id", userId);

    if (error) {

      console.log(
        "❌ Supabase save error:",
        error.message
      );

    }

  })
  .catch(err => {

    console.log(
      "⚠️ Background memory update failed:",
      err.message
    );

  });

}

return response;

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
// GENERATE IMAGE WITH NANO BANANA
// ------------------------------

async function generateFAIImage({
  prompt,
  res
}) {

  const API_KEY =
    process.env.GEMINI_API_KEY;

  for (const imageModel of IMAGE_MODELS) {

    try {

      console.log(
        `🎨 Trying image model: ${imageModel}`
      );

      const response =
        await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              "X-goog-api-key":
                API_KEY
            },

            body: JSON.stringify({

              contents: [
                {
                  parts: [
                    {
                      text: `
Create an educational visual based on the user's request.

The visual should be:

- Clear
- Useful for learning
- Easy for a student to understand
- Scientifically/academically accurate
- Clean and well organized
- Suitable for a student studying the topic
- Include labels when the user asks for a diagram
- Avoid unnecessary decorative elements

User request:
${prompt}
                      `.trim()
                    }
                  ]
                }
              ],

              generationConfig: {
                responseModalities: ["IMAGE"]
              }

            })
          }
        );

      // ------------------------------
      // MODEL FAILED
      // ------------------------------

      if (!response.ok) {

        const errorText =
          await response.text();

        console.log(
          `❌ ${imageModel} image error:`,
          errorText
        );

        // Try next image model
        continue;
      }

      // ------------------------------
      // READ RESPONSE
      // ------------------------------

      const data =
        await response.json();

      const parts =
        data
          ?.candidates?.[0]
          ?.content?.parts || [];

      const imagePart =
        parts.find(
          part => part.inlineData
        );

      if (
        !imagePart ||
        !imagePart.inlineData
      ) {

        console.log(
          `⚠️ ${imageModel} returned no image.`
        );

        continue;
      }

      const imageData =
        imagePart.inlineData.data;

      const mimeType =
        imagePart.inlineData.mimeType ||
        "image/png";

      console.log(
        `✅ Image generated with ${imageModel}`
      );

      // ------------------------------
      // SSE HEADERS
      // ------------------------------

      res.setHeader(
        "Content-Type",
        "text/event-stream"
      );

      res.setHeader(
        "Cache-Control",
        "no-cache"
      );

      res.setHeader(
        "Connection",
        "keep-alive"
      );

      res.flushHeaders();

      // ------------------------------
      // SEND IMAGE
      // ------------------------------

      res.write(
        `data: ${JSON.stringify({
          type: "image",
          data: imageData,
          mimeType,
          model: imageModel
        })}\n\n`
      );

      // ------------------------------
      // DONE
      // ------------------------------

      res.write(
        `data: ${JSON.stringify({
          type: "done"
        })}\n\n`
      );

      res.end();

      return true;

    } catch (err) {

      console.error(
        `❌ IMAGE GENERATION ERROR (${imageModel}):`,
        err.message
      );

      // Try next image model
      continue;
    }

  }

  // ------------------------------
  // ALL IMAGE MODELS FAILED
  // ------------------------------

  console.log(
    "❌ All image generation models failed."
  );

  return false;
}

// ------------------------------
// FAI STREAM
// ------------------------------

export async function fetchFAIStream({
  userId,
  messages = [],
  prompt,
  file = null,
  res
}) {

  const API_KEY =
  process.env.GEMINI_API_KEY;

let userMemory = {};

console.log("📝 FAI PROMPT:", prompt);
console.log("🖼️ IS IMAGE REQUEST:", isImageRequest(prompt));

/* ------------------------------
   IMAGE GENERATION
------------------------------ */

if (isImageRequest(prompt)) {

  console.log("🎨 IMAGE REQUEST DETECTED");

  const generated =
    await generateFAIImage({
      prompt,
      res
    });

  if (generated) {
    return;
  }

  console.log(
    "❌ ALL IMAGE MODELS FAILED"
  );

  res.setHeader(
    "Content-Type",
    "text/event-stream"
  );

  res.flushHeaders();

  res.write(
    `data: ${JSON.stringify({
      type: "error",
      message:
        "FAI detected an image request, but all image generation models are currently unavailable."
    })}\n\n`
  );

  res.end();

  return;
}

  // ------------------------------
  // LOAD MEMORY
  // ------------------------------

  if (userId) {

    const { data, error } = await supabase
      .from("fai_memory")
      .select("memory")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.log(
        "⚠️ Supabase fetch error:",
        error.message
      );
    }

    userMemory =
      data?.memory || {};
  }

  // ------------------------------
  // FORMAT CHAT
  // ------------------------------

  const context = messages
    .slice(-15)
    .map(m => {

      const role =
        m.role === "ai"
          ? "Assistant"
          : "User";

      return `${role}: ${m.text}`;

    })
    .join("\n");

  const memoryText =
    JSON.stringify(
      userMemory,
      null,
      2
    );
    
    // ------------------------------
// BUILD GEMINI CONTENT
// ------------------------------

const parts = [];

// Written prompt
parts.push({
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

If an image/file is attached:
- Inspect it carefully.
- Use the attached content as additional context.
- If the user's written message refers to the attachment, answer based on both.
- If the attachment contains a question, diagram, table, formula, handwritten work, or study material, explain it clearly.
- Do not ignore the user's written instructions just because an attachment exists.
`.trim()
});

// ------------------------------
// ATTACHED FILE
// ------------------------------

if (file) {

  const base64Data =
    file.buffer.toString("base64");

  parts.push({
    inline_data: {
      mime_type: file.mimetype,
      data: base64Data
    }
  });

}

  // ------------------------------
  // SSE HEADERS
  // ------------------------------

  res.setHeader(
    "Content-Type",
    "text/event-stream"
  );

  res.setHeader(
    "Cache-Control",
    "no-cache"
  );

  res.setHeader(
    "Connection",
    "keep-alive"
  );

  res.flushHeaders();

  // ------------------------------
  // TRY MODELS
  // ------------------------------

  for (const model of MODELS) {

    try {

      const response =
        await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              "X-goog-api-key":
                API_KEY
            },

            body: JSON.stringify({

  contents: [

    {
      parts
    }

  ]

})
          }
        );

      if (!response.ok) {

        const errorText =
          await response.text();

        console.log(
          `❌ ${model} stream error:`,
          errorText
        );

        continue;
      }

      // ------------------------------
      // READ GEMINI STREAM
      // ------------------------------

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      let fullAnswer = "";

      let buffer = "";

      while (true) {

        const {
          value,
          done
        } = await reader.read();

        if (done) break;

        buffer += decoder.decode(
          value,
          { stream: true }
        );

        const lines =
          buffer.split("\n");

        // keep incomplete line
        buffer =
          lines.pop() || "";

        for (const line of lines) {

          if (
            !line.startsWith("data:")
          ) {
            continue;
          }

          const jsonText =
            line
              .replace(
                /^data:\s*/,
                ""
              )
              .trim();

          if (!jsonText) continue;

          try {

            const event =
              JSON.parse(
                jsonText
              );

            const text =
              event
                ?.candidates?.[0]
                ?.content?.parts?.[0]
                ?.text;

            if (!text) continue;

            fullAnswer += text;

            // ------------------------------
            // SEND CHUNK TO FRONTEND
            // ------------------------------

            res.write(
              `data: ${JSON.stringify({
                type: "chunk",
                text
              })}\n\n`
            );

          } catch (err) {

            console.log(
              "⚠️ Stream JSON error:",
              err.message
            );

          }

        }

      }

      // ------------------------------
      // STREAM FINISHED
      // ------------------------------

      res.write(
        `data: ${JSON.stringify({
          type: "done"
        })}\n\n`
      );

      res.end();

      // ------------------------------
      // MEMORY IN BACKGROUND
      // ------------------------------

      if (
        userId &&
        fullAnswer
      ) {

        generateMemoryUpdate({

          userId,
          prompt,
          answer: fullAnswer,
          oldMemory: userMemory

        })
        .then(
          async updatedMemory => {

            if (!updatedMemory)
              return;

            const { error } =
              await supabase
                .from("fai_memory")
                .update({
                  memory:
                    updatedMemory
                })
                .eq(
                  "user_id",
                  userId
                );

            if (error) {

              console.log(
                "❌ Memory save error:",
                error.message
              );

            }

          }
        )
        .catch(err => {

          console.log(
            "⚠️ Background memory update failed:",
            err.message
          );

        });

      }

      return;

    } catch (err) {

      console.error(
        `❌ FAI STREAM ERROR (${model}):`,
        err.message
      );

    }

  }

  // ------------------------------
  // ALL MODELS FAILED
  // ------------------------------

  res.write(
    `data: ${JSON.stringify({
      type: "error",
      message:
        "FAI failed to respond. Please try again."
    })}\n\n`
  );

  res.end();

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
${limitWords(prompt, 300)}

AI responded:
${limitWords(answer, 300)}

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

let cleanText = text.trim();

// remove all code fences
cleanText = cleanText.replace(/```json|```/gi, "").trim();

// extract ONLY the JSON object (safer)
const match = cleanText.match(/\{[\s\S]*\}/);

if (!match) return null;

const newMemory = JSON.parse(match[0]);

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
       