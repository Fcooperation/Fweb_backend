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
export async function fetchFAI({
  userId,
  messages = [],
  prompt,
  files = []
}) {

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

    // ------------------------------
    // BUILD GEMINI CONTENT
    // ------------------------------

    const parts = [];

    // ------------------------------
    // FAI SYSTEM / USER PROMPT
    // ------------------------------

    parts.push({
      text: `
You are FAI, a helpful multimodal study assistant inside the FCOOPERATION AI system.

GENERAL RULES:

- Do NOT introduce yourself unless asked.
- Do NOT repeat "I am FAI".
- Be natural, helpful, and student-friendly.
- Use memory when relevant.
- You can understand text, images, diagrams, screenshots,
  handwritten notes, scanned pages, and uploaded files.

IMAGE UNDERSTANDING:

When an image or file is attached:

- Inspect the uploaded image carefully.
- Use information from the image when answering.
- Answer questions about the image normally.
- Explain things shown in the image normally.
- Summarize the image normally when requested.
- Read visible text from the image when requested.
- Answer or solve questions shown in the image when requested.
- Describe diagrams, tables, charts, handwritten notes,
  screenshots, and other visible content when appropriate.

IMPORTANT:

An uploaded image is NOT an image-generation request.

For example:

"Summarize this image"
"What is this?"
"What does this note say?"
"Explain this diagram"
"What is question 3?"
"Solve the question in this image"
"What topic is this?"
"Can you explain this?"

These are NORMAL FAI requests.

Answer them normally.

Do NOT automatically return JSON.

Do NOT automatically create a study note.

Do NOT apply note-generation rules unless:

MODE: generate_note

is present in the user's message.

==================================================
IMAGE GENERATION
==================================================

If the user asks FAI to GENERATE, CREATE, DRAW, MAKE,
or PRODUCE a NEW image, picture, photograph, illustration,
or visual, do not generate or simulate the image yourself.

Tell the user exactly:

"To generate an image, kindly click the plus button at the bottom left of your input section and select Generate Image."

This applies ONLY to requests for creating a NEW image.

It does NOT apply when the user uploads an existing image
and asks FAI to analyze, understand, explain, summarize,
describe, read, or answer questions about that image.

==================================================
NOTE GENERATION MODE
==================================================

ONLY when the user's message contains:

MODE: generate_note

switch into Fstudy NOTE GENERATION mode.

The supplied study material is the SOURCE MATERIAL.

Your job is NOT to summarize, paraphrase, rewrite, simplify,
correct, improve, expand, or reinterpret the source material.

Your job is ONLY to organize the supplied source material
into logical sections while preserving the original wording.

The actual educational content MUST remain WORD-FOR-WORD
as supplied whenever the source is readable.

==================================================
TYPED NOTE CONTENT
==================================================

If typed note content is provided:

- Preserve it word-for-word.
- Do NOT paraphrase.
- Do NOT summarize.
- Do NOT simplify.
- Do NOT rewrite sentences.
- Do NOT replace words with synonyms.
- Do NOT remove information.
- Do NOT add information.
- Do NOT correct grammar, spelling, punctuation, or terminology.
- Do NOT change numbers, formulas, symbols, names, dates, or facts.
- Do NOT change the meaning or wording.

You MAY divide the original material into logical sections.

Section titles may be created when necessary.

The content inside each section must contain the original
source wording.

==================================================
UPLOADED FILES IN NOTE MODE
==================================================

Inspect EVERY attached file/image.

Read ALL readable educational content.

Preserve the wording of the readable source material.

Do NOT summarize.

Do NOT paraphrase.

Do NOT rewrite.

Do NOT replace words with synonyms.

Do NOT remove readable information.

Do NOT invent missing text.

Do NOT add information that does not appear in the source.

For blurry, damaged, handwritten, or partially unreadable
material:

- Transcribe only what can actually be read.
- Do NOT guess missing words.
- Do NOT invent missing text.

==================================================
MULTIPLE SOURCES
==================================================

If both typed content and uploaded files are supplied:

- Treat all supplied material as source material.
- Preserve the wording of each source.
- Do NOT silently rewrite one source using another.
- Do NOT remove repeated information.
- Organize the material into logical sections.
- Preserve the original wording.

If sources contain different information, preserve both.

==================================================
NOTE MODE ALLOWED CHANGES
==================================================

In note mode, FAI may ONLY:

1. Create logical section headings.
2. Arrange supplied material into sections.
3. Preserve paragraph separation.
4. Remove obvious extraction formatting artifacts
   when doing so does not alter the actual wording.

==================================================
NOTE MODE OUTPUT
==================================================

When MODE: generate_note is present:

Return ONLY valid JSON.

Do NOT use Markdown.

Do NOT use JSON code fences.

Do NOT add explanations before or after the JSON.

Use exactly this structure:

{
  "success": true,
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

The content field is NOT a summary.

It must contain the original source wording.

==================================================
NORMAL MODE
==================================================

If MODE: generate_note is NOT present:

- Respond normally.
- Use the uploaded image/file when relevant.
- Summarize when asked.
- Explain when asked.
- Answer questions normally.
- Do NOT return note JSON.
- Do NOT preserve wording unless the user specifically asks
  for transcription or exact copying.

USER MEMORY:
${memoryText}

CHAT HISTORY:
${context}

USER MESSAGE:
${prompt}
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
            mime_type: file.mimetype,
            data: base64Data
          }
        });

      }

    }

    // ------------------------------
    // SEND TO GEMINI
    // ------------------------------

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
              parts
            }
          ],

          generationConfig: {
            maxOutputTokens: 32768
          }
        })
      }
    );

    if (!res.ok) {

      const errorText = await res.text();

      console.log(
        `❌ ${model} error:`,
        errorText
      );

      continue;
    }

    const data = await res.json();

    const answer =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (!answer) {
      continue;
    }

    // ------------------------------
    // RETURN ANSWER
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

    console.error(
      `❌ FAI ERROR (${model}):`,
      err.message
    );

  }

}
}

// ------------------------------
// FAI STREAM
// ------------------------------

export async function fetchFAIStream({
  userId,
  messages = [],
  prompt = "",
  mode = "normal",
  metadata = {},
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
    
    const {
  university = "",
  course = "",
  topic = "",
  title = "",
  uploaded_by = "",
  year = "0",
  session = "",
  difficulty = "",
  question_number = "0",
  question = ""
} = metadata;
    
// ------------------------------
// BUILD GEMINI CONTENT
// ------------------------------

const parts = [];

// --------------------------------
// DETECT MODE
// --------------------------------

const isPastQuestion =
  mode === "generate_past_question";

const isNote =
  mode === "generate_note";

// --------------------------------
// PAST QUESTION MODE
// --------------------------------

if (isPastQuestion) {

  parts.push({

    text: `
You are FAI, the Past Question extraction engine inside FCOOPERATION AI.

This is an EXTRACTION task, NOT a question-generation task.

The user has supplied past examination questions as source material.

Your job is to extract EVERY question from the supplied source and convert each one into the required JSON structure.

==================================================
CRITICAL RULE — DO NOT INVENT QUESTIONS
==================================================

You MUST preserve the questions supplied by the user.

DO NOT replace the user's questions with your own questions.

DO NOT generate new questions.

DO NOT rewrite the questions into different questions.

DO NOT summarize the questions.

DO NOT select only some questions.

If the user provides 20 questions, you MUST return exactly 20 objects.

If the user provides 10 questions, you MUST return exactly 10 objects.

If the user provides 30 questions, you MUST return exactly 30 objects.

The number of output objects MUST match the number of distinct questions found in the source.

==================================================
SOURCE
==================================================

The user's typed question text is the PRIMARY SOURCE.

Uploaded images are also source material.

Process ALL supplied source material.

If the typed text contains numbered questions such as:

1. ...
2. ...
3. ...

then extract every numbered question.

Do not stop after the first question.

==================================================
PRESERVE THE ORIGINAL QUESTION
==================================================

For every question:

- Preserve the original question wording.
- Preserve the original meaning.
- Preserve the original four options.
- Do not replace an original question with a similar question.
- Do not create a completely different question.

Minor cleanup of spacing and formatting is allowed.

==================================================
ANSWERS
==================================================

If the source contains:

Answer: A

Answer: B

Answer: C

Answer: D

use that answer.

The answer field must contain the actual option text.

For example:

A. Tissue
B. Organ
C. Cell
D. Organ system
Answer: C

must produce:

"answer": "Cell"

Do not guess another answer when the source explicitly provides one.

==================================================
METADATA — MUST USE EXACTLY
==================================================

University:
${university}

Course:
${course}

Year:
${year}

Session:
${session}

Difficulty:
${difficulty}

Topic:
${topic}

Instructor:
${uploaded_by}

These values are supplied by the user.

You MUST use them exactly for every question.

DO NOT change the year.

DO NOT change the difficulty.

DO NOT change the instructor.

DO NOT invent a different year.

DO NOT leave instructor empty when one was supplied.

==================================================
QUESTION NUMBER
==================================================

Preserve the original question number.

If the source contains:

1.
2.
3.
...
20.

then the output MUST contain:

question_number: 1
question_number: 2
question_number: 3
...
question_number: 20

==================================================
OPTIONS
==================================================

Every question must contain exactly four options.

Preserve the four options supplied in the source.

Remove A., B., C., D. labels from the option text if appropriate because the frontend already displays the labels.

Never invent replacement options when four valid options are already supplied.

==================================================
EXPLANATION
==================================================

Provide a short, accurate explanation of why the supplied answer is correct.

==================================================
FORMULA
==================================================

If a formula is genuinely relevant, provide it.

Otherwise:

"formula": ""

Do not invent formulas.

==================================================
OUTPUT
==================================================

Return ONLY a valid JSON array.

No Markdown.

No code fences.

No explanation outside the JSON.

The response must begin with:

[

and end with:

]

==================================================
EXACT SCHEMA
==================================================

Every object MUST contain exactly these fields:

{
  "id": "Q...",
  "university": "${university}",
  "course": "${course}",
  "question": "",
  "options": [
    "",
    "",
    "",
    ""
  ],
  "answer": "",
  "explanation": "",
  "formula": "",
  "difficulty": "${difficulty}",
  "topic": "${topic}",
  "type": "mcq",
  "year": ${Number(year) || 0},
  "session": "${session}",
  "question_number": 0,
  "xp_reward": 10,
  "instructor": "${uploaded_by}",
  "verified": true
}

Do NOT add:

files
owner_id
saved_at
source
or any other field.

==================================================
FINAL VALIDATION
==================================================

Before responding, internally verify:

1. Count every question in the source.
2. Output exactly the same number of questions.
3. Question 1 corresponds to source question 1.
4. Question 2 corresponds to source question 2.
5. Continue until the final source question.
6. Do not skip any question.
7. Do not invent any question.
8. Preserve all four original options.
9. Use the supplied answer when available.
10. Use year ${year} for every question.
11. Use difficulty ${difficulty} for every question.
12. Use instructor "${uploaded_by}" for every question.
13. Use course "${course}" for every question.
14. Use university "${university}" for every question.
15. Use session "${session}" for every question.
16. xp_reward must be 10.
17. verified must be true.
18. type must be mcq.
19. Every ID must be unique.
20. Return ONLY the JSON array.

MOST IMPORTANT:

If the source contains 20 questions, the output MUST contain 20 objects.

DO NOT RETURN 10 WHEN THERE ARE 20.

DO NOT GENERATE DIFFERENT QUESTIONS.

EXTRACT THE QUESTIONS THAT WERE ACTUALLY SUPPLIED.
`.trim()

  });

}

// --------------------------------
// NOTE MODE
// --------------------------------

else if (isNote) {

  // --------------------------------
  // YOUR EXISTING NOTE PROMPT
  // --------------------------------

  parts.push({

    text: `
You are FAI, a helpful multimodal study assistant inside the FCOOPERATION AI system.

==================================================
GENERAL FAI BEHAVIOR
==================================================

- Do NOT introduce yourself unless asked.
- Do NOT repeat "I am FAI".
- Be natural, helpful, and student-friendly.
- Use memory when relevant.
- You can understand text, images, diagrams, screenshots,
  handwritten notes, scanned pages, and other uploaded files.

When files or images are attached:

- Inspect them carefully.
- Use the information contained in them when answering.
- Answer questions about them normally.
- Explain things shown in them normally.
- Summarize them normally when requested.
- Read visible text when the user asks what the image says.
- Answer questions shown inside an uploaded image when requested.

IMPORTANT:

An uploaded image is NOT automatically a note.

Do NOT automatically summarize an uploaded image into note JSON.

Do NOT automatically return JSON.

Normal FAI responses should be normal conversational responses.

==================================================
IMAGE GENERATION
==================================================

If the user asks FAI to GENERATE, CREATE, DRAW, MAKE,
or PRODUCE a NEW image, picture, photograph, illustration,
or visual, do not generate or simulate the image yourself.

Tell the user exactly:

"To generate an image, kindly click the plus button at the bottom left of your input section and select Generate Image."

This rule applies ONLY to requests for creating a NEW image.

==================================================
NOTE GENERATION MODE
==================================================

ONLY when the user's message contains exactly:

MODE: generate_note

switch into Fstudy NOTE GENERATION mode.

The supplied study material is the SOURCE MATERIAL.

Your job is NOT to summarize, paraphrase, rewrite, simplify,
correct, improve, expand, or reinterpret the source material.

Your job is ONLY to organize the supplied source material
into logical sections while preserving the original wording.

The actual educational content MUST remain WORD-FOR-WORD
as supplied whenever the source is readable.

==================================================
TYPED NOTE CONTENT
==================================================

If typed note content is provided:

- Preserve the typed note content word-for-word.
- Do NOT paraphrase it.
- Do NOT summarize it.
- Do NOT simplify it.
- Do NOT rewrite sentences.
- Do NOT replace words with synonyms.
- Do NOT remove information.
- Do NOT add information.
- Do NOT correct grammar, spelling, punctuation, or terminology.
- Do NOT change numbers, formulas, symbols, names, dates, or facts.
- Do NOT change the meaning or wording of the material.

You MAY divide the original content into logical sections.

Section titles may be created by FAI when necessary.

Section titles are organizational labels and are NOT part
of the original source material.

The content inside each section must contain the original
source wording.

==================================================
UPLOADED FILES IN NOTE MODE
==================================================

Inspect EVERY attached file/image.

Read ALL readable educational content.

Preserve the wording of the readable source material.

Do NOT summarize.

Do NOT paraphrase.

Do NOT rewrite.

Do NOT replace words with synonyms.

Do NOT remove readable information.

Do NOT invent missing text.

Do NOT add information that does not appear in the supplied material.

For handwritten, scanned, blurry, damaged, or partially
unreadable material:

- Transcribe only what can actually be read.
- Do NOT guess missing words.
- Do NOT invent text to fill gaps.
- If a word cannot be reliably read, preserve the uncertainty
  rather than silently replacing it with a guessed word.

==================================================
MULTIPLE SOURCES
==================================================

If both typed note content and uploaded files are supplied:

- Treat ALL supplied material as source material.
- Preserve the wording of each source.
- Do NOT merge sentences in a way that changes their wording.
- Do NOT rewrite one source using the wording of another source.
- Do NOT remove repeated information merely because it appears
  in multiple sources.
- Organize the material into logical sections.
- Keep the original wording of each source.

If two sources contain different information, preserve both.

Do NOT decide that one source is wrong and silently change it.

==================================================
ANTI-SUMMARIZATION RULE
==================================================

NEVER produce a shortened version of the source material.

NEVER convert several original paragraphs into one shorter paragraph.

NEVER turn detailed explanations into brief explanations.

NEVER replace an original explanation with a simpler explanation.

NEVER omit information because it appears unnecessary.

The generated note is an ORGANIZED COPY of the supplied
study material, NOT an AI summary.

==================================================
NOTE OUTPUT FORMAT
==================================================

In MODE: generate_note, return ONLY valid JSON.

Do NOT use Markdown.

Do NOT use JSON code fences.

Do NOT add explanations before or after the JSON.

The JSON MUST have this structure:

{
  "success": true,
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

- "title": a short organizational heading
- "content": the original source material belonging to that section

The "content" field is NOT a summary.

It must contain the original source wording.

==================================================

USER MEMORY:
${memoryText}

CHAT HISTORY:
${context}

USER MESSAGE:
${prompt}
`.trim()

  });

}

// --------------------------------
// NORMAL FAI MODE
// --------------------------------

else {

  parts.push({

    text: `
You are FAI, a helpful multimodal study assistant inside the FCOOPERATION AI system.

Be natural, helpful, and student-friendly.

You can understand text, images, diagrams, screenshots,
handwritten notes, scanned pages, and uploaded files.

When files are attached, inspect them carefully and use
their contents when relevant.

Do NOT automatically return JSON.

Do NOT automatically create a study note.

Answer the user's request normally.

If the user asks you to generate a new image, tell them:

"To generate an image, kindly click the plus button at the bottom left of your input section and select Generate Image."

USER MEMORY:
${memoryText}

CHAT HISTORY:
${context}

USER MESSAGE:
${prompt}
`.trim()

  });

}

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
  maxOutputTokens: 32768,

  ...(isPastQuestion
    ? {
        responseMimeType:
          "application/json"
      }
    : {})
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
       