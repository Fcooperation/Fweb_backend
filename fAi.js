// fAi.js
import axios from 'axios';
import * as cheerio from 'cheerio';

function cleanText(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, '');
}

function scoreMatch(sentence, query) {
  const qWords = new Set(cleanText(query).split(/\s+/));
  const sWords = new Set(cleanText(sentence).split(/\s+/));
  let score = 0;
  qWords.forEach(word => {
    if (sWords.has(word)) score++;
  });
  return score;
}

function isLikelyQuestion(text) {
  return /^[A-Z]?[ ]*(What|Why|How|Is|Are|Can|Do|Does|Who|Where|When|Should|Could|Would|Will)\b/i.test(text);
}

export async function getAnswer(query) {
  try {
    // STEP 1: Wikipedia search for best page
    const searchRes = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        list: 'search',
        srsearch: query,
        format: 'json'
      }
    });

    const results = searchRes.data.query.search;
    if (!results || results.length === 0) return null;

    const bestTitle = results[0].title;
    const encodedTitle = encodeURIComponent(bestTitle);
    const pageUrl = `https://en.wikipedia.org/wiki/${encodedTitle}`;

    // STEP 2: Get full HTML content
    const htmlRes = await axios.get(pageUrl);
    const $ = cheerio.load(htmlRes.data);

    const pairs = [];

    // STEP 3: Find headings and their next paragraph(s)
    $('h2, h3, h4').each((_, el) => {
      const heading = $(el).text().trim();
      let answer = '';

      // Get next paragraph siblings
      let next = $(el).next();
      while (next.length && next[0].tagName === 'p') {
        answer += ' ' + next.text().trim();
        next = next.next();
      }

      if (answer && isLikelyQuestion(heading)) {
        pairs.push({ question: heading, answer: answer.trim() });
      }
    });

    // STEP 4: Also add intro paragraph if it defines the topic
    const intro = $('p').first().text().trim();
    if (intro.length > 30) {
      pairs.unshift({ question: `What is ${bestTitle}?`, answer: intro });
    }

    // STEP 5: Score matches
    const best = pairs
      .map(pair => ({
        ...pair,
        score: scoreMatch(pair.question + ' ' + pair.answer, query)
      }))
      .sort((a, b) => b.score - a.score)[0];

    // STEP 6: Return the best match
    if (best && best.score > 0) {
      return {
        title: bestTitle,
        source: pageUrl,
        question: best.question,
        answer: best.answer.split('. ').slice(0, 2).join('. ') + '.'
      };
    }

    // STEP 7: Fallback — use summary API
    const summaryRes = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`);
    const summary = summaryRes.data.extract?.split('. ')[0] + '.' || 'No summary found.';

    return {
      title: bestTitle,
      source: pageUrl,
      question: `What is ${bestTitle}?`,
      answer: summary
    };

  } catch (err) {
    console.error('❌ fAi error:', err.message);
    return null;
  }
}
