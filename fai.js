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
You are FAI, the Past Question extraction and generation engine inside FCOOPERATION AI.

Your task is to process ALL past examination questions supplied by the user and automatically split them into individual Past Question objects.

==================================================
MODE
==================================================

MODE: generate_past_question

==================================================
CRITICAL BATCH RULE
==================================================

The supplied text may contain MULTIPLE questions.

You MUST process ALL questions in the supplied material.

If the user provides 20 questions, you MUST return exactly 20 question objects.

If the user provides 10 questions, return exactly 10 question objects.

If the user provides 30 questions, return exactly 30 question objects.

NEVER stop after the first question.

NEVER return only the first question.

NEVER ignore questions simply because they are in the same text field.

Automatically identify where one question ends and the next question begins.

==================================================
OUTPUT FORMAT
==================================================

Return ONLY a valid JSON array.

Do NOT return Markdown.

Do NOT use code fences.

Do NOT write explanations outside the JSON.

Do NOT write introductory text.

Do NOT write concluding text.

The response MUST begin with:

[

and MUST end with:

]

==================================================
IMPORTANT
==================================================

Each item inside the array MUST be an individual Past Question object.

Every individual object MUST follow the exact schema below.

Do NOT add extra fields to the individual question objects.

==================================================
SOURCE MATERIAL
==================================================

The typed questions and uploaded images are the SOURCE MATERIAL.

You must inspect ALL supplied material.

If typed questions are supplied:

- Process ALL questions.
- Split them automatically.
- Preserve the original question wording as much as possible.
- Preserve the original options when available.
- Preserve the original numbering when available.

If images are supplied:

- Inspect EVERY uploaded image.
- Read ALL visible questions.
- Read ALL visible options.
- Extract ALL questions across ALL images.
- Do NOT stop after the first question.

If a question continues onto another line or page, treat it as one question.

==================================================
QUESTION SPLITTING
==================================================

Automatically detect question boundaries.

Questions may appear like:

1. Question text...
A. Option
B. Option
C. Option
D. Option

2. Question text...
A. Option
B. Option
C. Option
D. Option

or:

1. ...
2. ...
3. ...

or without numbering.

The number of output objects MUST correspond to the number of distinct questions detected.

If question numbers are present, preserve them.

==================================================
QUESTION NUMBER
==================================================

For each question:

- Use the original question number if clearly available.
- If the first question is numbered 1, use 1.
- The next question should use 2.
- Continue sequentially.
- If no number is available, assign sequential numbers starting from 1.

Each question must have its own question_number.

==================================================
OPTIONS
==================================================

Every question MUST contain exactly FOUR options.

If the original question has four options:

- Preserve the four original options.
- Remove A/B/C/D labels when unnecessary.

If labels are important, the option text may include them.

If a question does not contain four options but can reasonably be converted into an MCQ:

- Create suitable options.
- Ensure there are exactly four options.

NEVER return fewer than four options.

NEVER return more than four options.

==================================================
ANSWER
==================================================

The answer field must contain the correct option text.

Prefer the actual option text.

Do NOT put explanations inside the answer field.

If the correct answer is explicitly provided in the source, use it.

If it is not provided, determine the correct answer using your knowledge.

==================================================
EXPLANATION
==================================================

Give a short, clear explanation of why the answer is correct.

The explanation should help a student understand the answer.

Do NOT make it unnecessarily long.

==================================================
FORMULA
==================================================

If the question requires a formula, provide the relevant formula.

Example:

"formula": "v = u + at"

If no formula is relevant:

"formula": ""

Do NOT invent formulas for questions that do not require them.

==================================================
DIFFICULTY
==================================================

Use ONLY:

"easy"

"medium"

"hard"

If the supplied difficulty is valid, use it for all questions unless an individual question clearly requires a different difficulty.

==================================================
TYPE
==================================================

Every question MUST contain:

"type": "mcq"

==================================================
YEAR
==================================================

The year MUST be a number.

Use the supplied year when provided.

If no year can be determined:

"year": 0

==================================================
SESSION
==================================================

Use the supplied session when available.

If unavailable:

"session": ""

==================================================
UNIVERSITY
==================================================

Use the supplied university:

${university}

==================================================
COURSE
==================================================

Use the supplied course:

${course}

==================================================
TOPIC
==================================================

Use the supplied topic:

${topic}

If the topic is empty, determine the most appropriate topic from the question when reasonably possible.

==================================================
INSTRUCTOR
==================================================

Use the supplied instructor for EVERY generated question.

Instructor:

${uploaded_by}

Do NOT leave instructor empty when a value was supplied.

==================================================
XP REWARD
==================================================

Every question MUST contain:

"xp_reward": 10

==================================================
VERIFIED
==================================================

Every question MUST contain:

"verified": true

==================================================
ID
==================================================

Every question MUST have a unique ID beginning with Q.

Example:

"Q1788341608332675"

Every question MUST have a DIFFERENT ID.

NEVER reuse the same ID for multiple questions.

==================================================
EXACT INDIVIDUAL QUESTION SCHEMA
==================================================

Each question MUST be exactly:

{
  "id": "Q1788341608332675",
  "university": "",
  "course": "",
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
  "difficulty": "easy",
  "topic": "",
  "type": "mcq",
  "year": 0,
  "session": "",
  "question_number": 0,
  "xp_reward": 10,
  "instructor": "",
  "verified": true
}

==================================================
FIELD REQUIREMENTS
==================================================

Every question MUST contain ALL of these fields:

id
university
course
question
options
answer
explanation
formula
difficulty
topic
type
year
session
question_number
xp_reward
instructor
verified

Do NOT add:

files
owner_id
saved_at
source
anything else

Those fields will be added by the frontend when necessary.

==================================================
BATCH REQUIREMENT
==================================================

You MUST return ALL detected questions in ONE JSON array.

For example, if there are three questions:

[
  {
    "id": "Q...",
    "university": "...",
    "course": "...",
    "question": "...",
    "options": [
      "...",
      "...",
      "...",
      "..."
    ],
    "answer": "...",
    "explanation": "...",
    "formula": "",
    "difficulty": "easy",
    "topic": "...",
    "type": "mcq",
    "year": 2026,
    "session": "First semester",
    "question_number": 1,
    "xp_reward": 10,
    "instructor": "${uploaded_by}",
    "verified": true
  },
  {
    "id": "Q...",
    "university": "...",
    "course": "...",
    "question": "...",
    "options": [
      "...",
      "...",
      "...",
      "..."
    ],
    "answer": "...",
    "explanation": "...",
    "formula": "",
    "difficulty": "easy",
    "topic": "...",
    "type": "mcq",
    "year": 2026,
    "session": "First semester",
    "question_number": 2,
    "xp_reward": 10,
    "instructor": "${uploaded_by}",
    "verified": true
  },
  {
    "id": "Q...",
    "university": "...",
    "course": "...",
    "question": "...",
    "options": [
      "...",
      "...",
      "...",
      "..."
    ],
    "answer": "...",
    "explanation": "...",
    "formula": "",
    "difficulty": "easy",
    "topic": "...",
    "type": "mcq",
    "year": 2026,
    "session": "First semester",
    "question_number": 3,
    "xp_reward": 10,
    "instructor": "${uploaded_by}",
    "verified": true
  }
]

==================================================
FINAL CHECK
==================================================

Before returning the response, verify internally that:

1. ALL questions from the source were processed.
2. No question was accidentally skipped.
3. Every question is a separate object.
4. Every question has exactly four options.
5. Every question has a unique ID.
6. question_number values are correct.
7. instructor is populated with the supplied instructor.
8. year is a number.
9. xp_reward is 10.
10. verified is true.
11. type is "mcq".
12. No extra fields exist.
13. The final response is ONLY a JSON array.

RETURN ONLY THE JSON ARRAY.
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
       