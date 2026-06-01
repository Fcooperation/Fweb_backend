export async function fetchFAI(prompt) {

  const API_KEY = "AQ.Ab8RN6Jt0S0irgd-BRlAFh9HNKvHDju_7u-46oZK3XKRCZdNOQ";

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

    // 🚀 RETURN RAW GEMINI RESPONSE (no filtering)
    return data;

  } catch (err) {

    console.error("FAI ERROR:", err);

    return {
      error: "FAI failed",
      details: err
    };

  }
}
