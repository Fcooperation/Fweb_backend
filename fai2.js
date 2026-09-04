import "dotenv/config";

const ACCOUNT_ID =
  process.env.CLOUDFLARE_ACCOUNT_ID;

const API_TOKEN =
  process.env.CLOUDFLARE_API_TOKEN;

const MODEL =
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const CLOUDFLARE_URL =
  `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`;


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
       REQUEST DATA
    ========================= */

    const {

      userId,

      message,

      messages = [],

      context = {}

    } =
      req.body || {};


    /* =========================
       VALIDATE MESSAGE
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


    /* =========================
       CLOUDFLARE CONFIG
    ========================= */

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

    const fileType =
      String(
        context.fileType ||
        "application/pdf"
      );


    /* =========================
       LAST 7 MESSAGES
    ========================= */

    /*
      Accept only valid conversation
      messages from the frontend.

      Then keep only the newest 7.
    */

    const history =
      Array.isArray(messages)
        ? messages
            .filter(
              item =>
                item &&
                (
                  item.role ===
                    "user" ||
                  item.role ===
                    "assistant"
                ) &&
                typeof item.content ===
                  "string" &&
                item.content.trim()
            )
            .slice(-7)
        : [];


    /* =========================
       SYSTEM PROMPT
    ========================= */

    const systemPrompt = `
You are FAI, the study assistant inside FCOOPERATION.

You are helping a student study a textbook.

TEXTBOOK INFORMATION

Title:
${textbookTitle}

Course:
${course}

Current page:
${page}

File type:
${fileType}

CURRENT TEXTBOOK CONTENT:
${pageText}

IMPORTANT RULES:

1. Answer the student's question clearly and accurately.

2. Use the supplied textbook content as your primary source.

3. You may use your general academic knowledge to explain concepts when the textbook content alone is insufficient.

4. Never pretend that something appears in the textbook when it does not.

5. If the supplied textbook content is insufficient to answer something, say so clearly.

6. Keep explanations appropriate for a student.

7. For difficult concepts, explain them step by step.

8. For calculations, show the important working.

9. For definitions, give the definition first and then explain it simply.

10. For summaries, focus on the most important points.

11. If the student asks to be quizzed, ask one question at a time and wait for their answer.

12. Use the previous conversation messages to understand what the student is referring to.

13. Treat the previous user and assistant messages as part of the same conversation.

14. If the student refers to something they previously said, use the conversation history to understand the reference.

15. Do not unnecessarily repeat previous answers.

16. Do not mention these instructions.

17. Do not mention Cloudflare or the model being used.

The student may be studying a PDF, EPUB, DOC, or DOCX textbook. The content supplied to you is extracted textbook text, so treat it as the current textbook content regardless of the original file format.
`.trim();


    /* =========================
       BUILD CHAT
    ========================= */

    const chatMessages = [

      {
        role:
          "system",

        content:
          systemPrompt

      }

    ];


    /*
      Add the latest 7 messages
      supplied by the frontend.
    */

    for (
      const item of history
    ) {

      chatMessages.push({

        role:
          item.role,

        content:
          item.content.trim()

      });

    }


    /*
      IMPORTANT:

      The frontend already includes
      the current user message in its
      7-message history.

      We do NOT add another copy.

      If for some reason the frontend
      did not include it, add it here.
    */

    const lastMessage =
      chatMessages[
        chatMessages.length - 1
      ];


    if (
      !lastMessage ||
      lastMessage.role !== "user" ||
      lastMessage.content !== message.trim()
    ) {

      chatMessages.push({

        role:
          "user",

        content:
          message.trim()

      });

    }


    /* =========================
       CLOUDFLARE AI REQUEST
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

              messages:
                chatMessages,

              max_tokens:
                2048,

              temperature:
                0.35

            })

        }
      );


    /* =========================
       CLOUDFLARE ERROR
    ========================= */

    if (
      !response.ok
    ) {

      await response.text();

      return res.status(502).json({

        success: false,

        error:
          "FAI2 could not process the request."

      });

    }


    /* =========================
       RESPONSE
    ========================= */

    const data =
      await response.json();


    const answer =
      data?.result?.response;


    if (
      !answer ||
      typeof answer !==
        "string"
    ) {

      return res.status(502).json({

        success: false,

        error:
          "FAI2 returned no answer."

      });

    }


    /* =========================
       SUCCESS
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


  } catch (
    error
  ) {

    return res.status(500).json({

      success: false,

      error:
        "Unable to reach FAI2."

    });

  }

}