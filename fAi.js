import axios from 'axios';

function cleanText(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, '');
}

function scoreSentence(sentence, query) {
  const queryWords = new Set(cleanText(query).split(/\s+/));
  const sentenceWords = new Set(cleanText(sentence).split(/\s+/));
  let score = 0;
  queryWords.forEach(word => {
    if (sentenceWords.has(word)) score++;
  });
  return score;
}

export async function getAnswer(query) {
  try {
    const searchRes = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        list: 'search',
        srsearch: query,
        format: 'json',
      }
    });

    const results = searchRes.data.query.search;
    if (!results || results.length === 0) return null;

    const bestTitle = results[0].title;
    const encodedTitle = encodeURIComponent(bestTitle);

    const summaryRes = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`);
    const summaryData = summaryRes.data;

    const fullText = summaryData.extract || '';
    const sentences = fullText.split(/(?<=[.?!])\s+/).filter(s => s.length > 20);

    if (sentences.length === 0) return null;

    // If sentence starts with direct answer format, return that
    const direct = sentences.find(s =>
      /^(yes|no|it|they|he|she|this|that|the)/i.test(s.trim())
    );

    const best = direct || sentences
      .map(s => ({ text: s, score: scoreSentence(s, query) }))
      .sort((a, b) => b.score - a.score)[0].text;

    return {
      title: bestTitle,
      main: best,
      source: summaryData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodedTitle}`
    };

  } catch (err) {
    console.error('❌ fAi error:', err.message);
    return null;
  }
}
