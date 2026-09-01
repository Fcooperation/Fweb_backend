import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const MODELS = [
  // 🔥 Primary (best balance of intelligence + speed)
  "gemini-3.5-flash",

  // ⚡ Fast fallback (cheap + reliable)
  "gemini-3.1-flash-lite",

  // 🧠 Strong reasoning / memory extraction
  "gemini-2.5-flash",

  // 🧠 Advanced reasoning (slowest but smartest fallback)
  "gemini-3.1-pro-preview"
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

VISUAL REQUESTS:

Understand the user's intent semantically.

If the user's request is interpreted as asking for an image, picture,
photograph, illustration, visual, or any other image-generation request,
do NOT generate or simulate an image yourself.

Instead, do NOT answer the image request normally.

Tell the user exactly:

"To generate an image, kindly click the plus button at the bottom left of your input section and select Generate Image."

This rule applies regardless of the wording used by the user.
Do not rely on specific trigger words or fixed phrases.

Examples of requests that should follow this rule include, but are not
limited to:

- asking to generate an image
- asking to make a picture
- asking to create a photo
- asking to draw something
- asking to show a visual
- asking for an illustration
- asking for a picture of something

The wording may be completely different from these examples. Use the
meaning and intent of the request.

Do not call, simulate, imitate, or output any image-generation tool.
Do not provide an image URL.
Do not claim that an image was generated.
Do not explain the technical reason for this behavior.

When the request is interpreted as an image-generation request, the
instruction above takes priority over the normal conversational response.

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
// FAI STREAM
// ------------------------------

export async function fetchFAIStream({
  userId,
  messages = [],
  prompt,
  files = [],
  res
}) {

  const API_KEY = process.env.GEMINI_API_KEY;

  let userMemory = {};

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

VISUAL REQUESTS:

Understand the user's intent semantically.

If the user's request is interpreted as asking for an image, picture,
photograph, illustration, visual, or any other image-generation request,
do NOT generate or simulate an image yourself.

Instead, do NOT answer the image request normally.

Tell the user exactly:

"To generate an image, kindly click the plus button at the bottom left of your input section and select Generate Image."

This rule applies regardless of the wording used by the user.
Do not rely on specific trigger words or fixed phrases.

Examples of requests that should follow this rule include, but are not
limited to:

- asking to generate an image
- asking to make a picture
- asking to create a photo
- asking to draw something
- asking to show a visual
- asking for an illustration
- asking for a picture of something

The wording may be completely different from these examples. Use the
meaning and intent of the request.

Do not call, simulate, imitate, or output any image-generation tool.
Do not provide an image URL.
Do not claim that an image was generated.
Do not explain the technical reason for this behavior.

When the request is interpreted as an image-generation request, the
instruction above takes priority over the normal conversational response.

USER MEMORY:
${memoryText}

CHAT HISTORY:
${context}

USER MESSAGE:
${prompt}

REQUEST MODE:
If the user message contains:

MODE: generate_note

then this is a NOTE GENERATION request.

For a NOTE GENERATION request:

- Carefully inspect ALL attached images and files.
- Read the supplied typed note content.
- Combine information from all supplied materials.
- Do not ignore any readable information in the attachments.
- Organize the material into logical study-note sections.
- Do not invent information that is not supported by the supplied material.
- Use the supplied university, course, topic, title, and uploaded_by values exactly when provided.
- Create clear, useful student-friendly sections.
- Return ONLY valid JSON.
- Do NOT use Markdown.
- Do NOT use JSON code fences.
- Do NOT add explanations before or after the JSON.

The JSON MUST have exactly this general structure:

{
  "university": "...",
  "course": "...",
  "topic": "...",
  "title": "...",
  "uploaded_by": "...",
  "sections": [
    {
      "title": "...",
      "content": "..."
    }
  ]
}

Each section must contain:
- "title": a short section heading
- "content": the actual study-note content

If files are attached:
- Inspect every attached file/image.
- Extract relevant educational information from them.
- Combine information across the files when appropriate.

If typed note content is provided:
- Use it together with the uploaded files.

For normal FAI requests that are NOT note generation requests, behave normally.

If an image/file is attached to a normal FAI request:
- Inspect it carefully.
- Use the attached content as additional context.
- If the user's written message refers to the attachment, answer based on both.
- If the attachment contains a question, diagram, table, formula, handwritten work, or study material, explain it clearly.
- Do not ignore the user's written instructions just because an attachment exists.
`.trim()
});

// ------------------------------
// ATTACHED FILES / IMAGES
// ------------------------------

if (Array.isArray(files)) {

  for (const file of files) {

    if (!file?.buffer) {
      continue;
    }

    const base64Data =
      file.buffer.toString("base64");

    parts.push({

      inline_data: {

        mime_type:
          file.mimetype,

        data:
          base64Data

      }

    });

  }

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
    ],

    generationConfig: {
        maxOutputTokens: 32768
    }
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
cleanText = cleanText
  .replace(/```json/gi, "")
  .replace(/```/g, "")
  .trim();

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
       