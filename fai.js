import "dotenv/config";

const MODELS = [
  "gemini-3.1-flash-lite", // default
  "gemini-2.5-flash",
  "gemini-3.5-flash",
  "gemini-3-flash-preview"
];

export async function fetchFAI(prompt) {

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
                    text: `You are FAI (FCOOPERATION Study AI).

Explain clearly for students in simple terms.

Question:
${prompt}`
                  }
                ]
              }
            ]
          })
        }
      );

      const data = await res.json();

      console.log(
        `FAI RAW RESPONSE (${model}):`,
        JSON.stringify(data, null, 2)
      );

      const answer =
        data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (answer) {
        return {
          answer,
          model
        };
      }

    } catch (err) {

      console.error(
        `FAI ERROR (${model}):`,
        err
      );

    }

  }

  return {
    answer: "FAI failed to respond."
  };

    }
