import "dotenv/config";

export async function fetchFAI(prompt) {

  try {

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `
You are FAI (FCOOPERATION Study AI).

Rules:
- Explain in simple student-friendly way
- Keep answers clear and short unless asked for detail
- Focus on education (math, science, exams, tech)

Question:
${prompt}
                  `
                }
              ]
            }
          ]
        })
      }
    );

    const data = await res.json();

    const answer =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response from AI.";

    return {
      answer
    };

  } catch (err) {

    console.error("FAI ERROR:", err);

    return {
      answer: "FAI failed to respond. Try again."
    };

  }
}
