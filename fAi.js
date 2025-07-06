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

async function fetchFromWikipedia(query) {
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

    const main = summaryData.extract?.split('. ')[0] + '.' || "No summary found.";
    const source = summaryData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodedTitle}`;

    return {
      sourceName: 'Wikipedia',
      main,
      title: bestTitle,
      source
    };
  } catch (err) {
    console.error('❌ Wikipedia error:', err.message);
    return null;
  }
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
  const [wiki, duck] = await Promise.all([
    fetchFromWikipedia(query),
    fetchFromDuckDuckGo(query)
  ]);

  const results = [wiki, duck].filter(Boolean);
  if (results.length === 0) return null;

  results.sort((a, b) => scoreAnswer(b.main, query) - scoreAnswer(a.main, query));
  return results[0]; // return best matched
}
