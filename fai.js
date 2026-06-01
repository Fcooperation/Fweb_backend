export async function fetchFAI(prompt) {

  const API_KEY = "AQ.Ab8RN6KgwITYrsONaxtnsA9_lx4JG7ueJNZcmVsXjulA1ZCxYQ";

  try {

    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
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

    console.log("FAI RAW RESPONSE:", JSON.stringify(data, null, 2));

    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    return {
      answer: answer ?? "No response from AI."
    };

  } catch (err) {

    console.error("FAI ERROR:", err);

    return {
      answer: "FAI failed to respond."
    };

  }
      }
