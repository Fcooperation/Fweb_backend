// fAi.js
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

    // Try exact match
    const exactMatch = results.find(r => r.title.toLowerCase() === query.toLowerCase());

    // Score based match fallback
    const best = exactMatch || results
      .map(r => ({
        ...r,
        score: scoreSentence(r.title, query)
      }))
      .sort((a, b) => b.score - a.score)[0];

    const encodedTitle = encodeURIComponent(best.title);
    const summaryRes = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`);
    const summaryData = summaryRes.data;

    const fullText = summaryData.extract || '';
    const sentences = fullText.split(/(?<=[.?!])\s+/).filter(s => s.length > 20);

    if (sentences.length === 0) return null;

    const bestSentence = sentences
      .map(s => ({ text: s, score: scoreSentence(s, query) }))
      .sort((a, b) => b.score - a.score)[0].text;

    return {
      title: best.title,
      main: bestSentence,
      source: summaryData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodedTitle}`
    };

  } catch (err) {
    console.error('❌ fAi error:', err.message);
    return null;
  }
}
