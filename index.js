import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 🧠 Clean text and score helpers
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
function getBestSentence(sentences, query) {
  const scored = sentences.map(text => ({
    text: text.trim(),
    score: scoreSentence(text, query)
  })).filter(s => s.score > 0);
  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

// 🧱 200 Sites grouped by category
const siteGroups = {
  wikipedia: ['https://en.wikipedia.org/wiki/'],
  dictionary: [
    'https://www.merriam-webster.com/dictionary/',
    'https://dictionary.cambridge.org/dictionary/english/',
    'https://www.oxfordlearnersdictionaries.com/definition/english/',
    'https://www.collinsdictionary.com/dictionary/english/',
    'https://www.vocabulary.com/dictionary/',
    'https://www.ldoceonline.com/dictionary/',
    'https://www.macmillandictionary.com/dictionary/british/',
    'https://www.thefreedictionary.com/',
    'https://www.yourdictionary.com/'
  ],
  books: [
    'https://www.gutenberg.org/ebooks/search/?query=',
    'https://openlibrary.org/search?q=',
    'https://books.google.com/books?q=',
    'https://archive.org/search.php?query=',
    'https://www.goodreads.com/search?q='
  ],
  news: [
    'https://www.bbc.com/search?q=',
    'https://edition.cnn.com/search?q=',
    'https://www.reuters.com/site-search/?query=',
    'https://www.nytimes.com/search?query=',
    'https://www.aljazeera.com/search/?q=',
    'https://www.marketwatch.com/search?q=',
    'https://www.bloomberg.com/search?query=',
    'https://www.ft.com/search?q=',
    'https://finance.yahoo.com/search?q='
  ],
  science: [
    'https://www.sciencedaily.com/search/?keyword=',
    'https://scholar.google.com/scholar?q=',
    'https://arxiv.org/search/?query=',
    'https://pubmed.ncbi.nlm.nih.gov/?term=',
    'https://www.nature.com/search?q=',
    'https://www.nih.gov/search?keys=',
    'https://www.cdc.gov/search/results?query=',
    'https://www.who.int/news-room/questions-and-answers?search='
  ],
  tech: [
    'https://stackoverflow.com/search?q=',
    'https://www.geeksforgeeks.org/?s=',
    'https://www.w3schools.com/howto/howto_js_search_menu.asp?q=',
    'https://www.tutorialspoint.com/index.php?search=',
    'https://www.khanacademy.org/search?page_search_query='
  ],
  health: [
    'https://www.webmd.com/search/search_results/default.aspx?query=',
    'https://www.medicalnewstoday.com/search?q=',
    'https://www.healthboards.com/search?q='
  ],
  forums: [
    'https://www.reddit.com/search/?q=',
    'https://www.quora.com/search?q='
  ],
  sports: [
    'https://www.espn.com/search/results?q=',
    'https://www.goal.com/en/search/',
    'https://www.nfl.com/search/?query=',
    'https://www.nba.com/search/?q=',
    'https://www.mlssoccer.com/search?q=',
    'https://www.formula1.com/en/search.html?query='
  ],
  travel: [
    'https://www.lonelyplanet.com/search?q=',
    'https://www.tripadvisor.com/Search?q=',
    'https://www.booking.com/searchresults.html?ss=',
    'https://www.airbnb.com/s/'
  ],
  cooking: [
    'https://www.allrecipes.com/search/results/?search=',
    'https://www.foodnetwork.com/search/',
    'https://www.epicurious.com/search/',
    'https://www.bbcgoodfood.com/search/recipes?q=',
    'https://www.jamieoliver.com/search/?q=',
    'https://www.delish.com/search/?q='
  ],
  lyrics: [
    'https://www.lyrics.com/serp.php?st=',
    'https://www.azlyrics.com/search.php?q=',
    'https://genius.com/search?q='
  ],
  movies: [
    'https://www.imdb.com/find?q=',
    'https://www.rottentomatoes.com/search?search=',
    'https://www.metacritic.com/search/all/',
    'https://www.themoviedb.org/search?query='
  ],
  images: [
    'https://unsplash.com/s/photos/',
    'https://pixabay.com/images/search/',
    'https://www.pexels.com/search/',
    'https://flickr.com/search/?text='
  ]
};

// 🕷️ Crawl and rank one site
async function crawlSite(url, query) {
  try {
    const fullUrl = url + encodeURIComponent(query);
    const html = (await axios.get(fullUrl, { timeout: 8000 })).data;
    const $ = cheerio.load(html);

    const sentences = [];
    $('p').each((_, el) => {
      const para = $(el).text().trim();
      if (para.length > 30) {
        const chunks = para.split(/(?<=[.?!])\s+/);
        sentences.push(...chunks);
      }
    });

    const best = getBestSentence(sentences, query);
    if (!best) return null;

    const images = [];
    $('img').each((_, el) => {
      const src = $(el).attr('src');
      if (src && !src.includes('icon') && !src.includes('logo')) {
        images.push(src.startsWith('http') ? src : `https:${src}`);
      }
    });

    return {
      main: best.text,
      score: best.score,
      source: fullUrl,
      title: url,
      images: [...new Set(images)].slice(0, 20)
    };
  } catch {
    return null;
  }
}

// 📥 /search handler
app.post('/search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Missing query' });

  const resultByCategory = {};
  const allPromises = [];

  for (const [category, sites] of Object.entries(siteGroups)) {
    const crawls = sites.map(site => crawlSite(site, query).then(data => ({ category, data })));
    allPromises.push(...crawls);
  }

  const results = await Promise.allSettled(allPromises);
  const successful = results
    .filter(r => r.status === 'fulfilled' && r.value && r.value.data)
    .map(r => r.value);

  // Group by category: pick best per category
  for (const { category, data } of successful) {
    if (!resultByCategory[category]) {
      resultByCategory[category] = [];
    }
    resultByCategory[category].push(data);
  }

  // Pick best sentence globally
  let globalBest = null;
  for (const cat in resultByCategory) {
    resultByCategory[cat].sort((a, b) => b.score - a.score);
    if (!globalBest || resultByCategory[cat][0].score > globalBest.score) {
      globalBest = resultByCategory[cat][0];
    }
  }

  res.json({
    response: globalBest?.main || `❌ Couldn't find anything for "${query}"`,
    images: globalBest?.images || [],
    title: globalBest?.title || '',
    source: globalBest?.source || '',
    categories: Object.keys(resultByCategory),
    results: resultByCategory
  });
});

app.listen(PORT, () => {
  console.log(`🚀 fAi ranked search engine running on port ${PORT}`);
});
