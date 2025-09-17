import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: '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',
  defaultHeaders: {
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': '<YOUR_SITE_NAME>',     // Optional. Site title for rankings on openrouter.ai.
  },
});

export async function fetchFAI(query) {
  const completion = await openai.chat.completions.create({
    model: 'openai/gpt-4o',
    messages: [
      {
        role: 'user',
        content: query,
      },
    ],
  });

  return completion.choices[0].message;
}

// 👇 Ensure it runs when you call `node index.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchFAI("What is the meaning of life?").then(console.log).catch(console.error);
}
