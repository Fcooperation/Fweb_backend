// fAi.js
import axios from 'axios';

function cleanText(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, '');
}

function scoreAnswer(answer, query) {
  const queryWords = new Set(cleanText(query).split(/\s+/));
  const answerWords = new Set(cleanText(answer).split(/\s+/));
  let score = 0;
  queryWords.forEach(word => {
    if (answerWords.has(word)) score++;
  });
  return score;
}

async function fetchFromDuckDuckGo(query) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
    const res = await axios.get(url);
    const data = res.data;

    const main = data.AbstractText?.split('. ')[0] + '.' || null;
    const source = data.AbstractURL || null;
    const title = data.Heading || "DuckDuckGo Result";

    if (!main || !source) return null;

    return {
      sourceName: 'DuckDuckGo',
      main,
      title,
      source
    };
  } catch (err) {
    console.error('❌ DuckDuckGo error:', err.message);
    return null;
  }
}

export async function getAnswer(query) {
  const duck = await fetchFromDuckDuckGo(query);
  return duck || null;
}
