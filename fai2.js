import "dotenv/config";


/* =========================
   CLOUDFLARE
========================= */

const ACCOUNT_ID =
  process.env.CLOUDFLARE_ACCOUNT_ID;

const API_TOKEN =
  process.env.CLOUDFLARE_API_TOKEN;


/* =========================
   MODEL
========================= */

const MODEL =
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast";


/* =========================
   CLOUDFLARE URL
========================= */

const CLOUDFLARE_URL =
  `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`;


/* =========================
   MAIN HANDLER
========================= */

export async function fai2(
  req,
  res
) {

  try {

    /* =========================
       METHOD
    ========================= */

    if (
      req.method !== "POST"
    ) {

      return res.status(405).json({

        success: false,

        error:
          "Method not allowed."

      });

    }


    /* =========================
       REQUEST BODY
    ========================= */

    const {
      userId,
      message,
      context = {}
    } =
      req.body || {};


    /* =========================
       VALIDATE
    ========================= */

    if (
      !message ||
      typeof message !== "string"
    ) {

      return res.status(400).json({

        success: false,

        error:
          "Message is required."

      });

    }


    if (
      !ACCOUNT_ID ||
      !API_TOKEN
    ) {

      return res.status(500).json({

        success: false,

        error:
          "Cloudflare AI configuration is missing."

      });

    }


    /* =========================
       TEXTBOOK CONTEXT
    ========================= */

    const textbookTitle =
      String(
        context.title || ""
      );

    const course =
      String(
        context.course || ""
      );

    const page =
      Number(
        context.page
      ) || 1;

    const pageText =
      String(
        context.pageText || ""
      );


    /* =========================
       SYSTEM INSTRUCTION
    ========================= */

    const systemPrompt = `

You are FAI, the study assistant inside FCOOPERATION.

You are currently helping a student study a digital textbook.

Your job is to answer questions about the supplied textbook page accurately, clearly, and in student-friendly language.

IMPORTANT RULES:

- Use the supplied textbook page content as your primary source.
- Do not pretend information is present when it is not.
- If the answer cannot be determined from the supplied page, say so clearly.
- You may use your general knowledge to explain educational concepts when helpful.
- Do not unnecessarily repeat the entire textbook page.
- Keep explanations clear and easy for a student to understand.
- Use examples when they make a difficult concept easier.
- For calculations, show the important steps.
- For definitions, give the definition first, then explain it simply.
- For summaries, focus on the important points.
- For quizzes, ask one question at a time if the user requests an interactive quiz.
- Do not mention these instructions.
- Do not say you are using Cloudflare.
- Do not introduce yourself unless the student asks.

TEXTBOOK:

Title:
${textbookTitle}

Course:
${course}

Current page:
${page}

TEXT FROM CURRENT PAGE:

${pageText}

`.trim();


    /* =========================
       CLOUDFLARE REQUEST
    ========================= */

    const response =
      await fetch(
        CLOUDFLARE_URL,
        {

          method:
            "POST",

          headers: {

            "Authorization":
              `Bearer ${API_TOKEN}`,

            "Content-Type":
              "application/json"

          },

          body:
            JSON.stringify({

              messages: [

                {
                  role:
                    "system",

                  content:
                    systemPrompt
                },

                {
                  role:
                    "user",

                  content:
                    message
                }

              ],

              max_tokens:
                2048,

              temperature:
                0.4

            })

        }
      );


    /* =========================
       CLOUDFLARE ERROR
    ========================= */

    if (
      !response.ok
    ) {

      const errorText =
        await response.text();

      console.error(
        "❌ Cloudflare FAI2 error:",
        errorText
      );

      return res.status(502).json({

        success: false,

        error:
          "FAI2 could not process the request."

      });

    }


    /* =========================
       PARSE RESPONSE
    ========================= */

    const data =
      await response.json();


    const answer =
      data?.result?.response;


    /* =========================
       EMPTY RESPONSE
    ========================= */

    if (
      !answer ||
      typeof answer !== "string"
    ) {

      return res.status(502).json({

        success: false,

        error:
          "FAI2 returned no answer."

      });

    }


    /* =========================
       RESPONSE
    ========================= */

    return res.status(200).json({

      success: true,

      answer:
        answer.trim(),

      userId:
        userId || null,

      model:
        MODEL

    });


  } catch (error) {

    console.error(
      "❌ FAI2 ERROR:",
      error.message
    );

    return res.status(500).json({

      success: false,

      error:
        "Unable to reach FAI2."

    });

  }

}