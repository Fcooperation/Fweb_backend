import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import cors from 'cors';
import { getAnswer } from './fAi.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 200 Crawlable Sites (search URLs)
const siteList = [
  'https://en.wikipedia.org/wiki/',
  'https://www.britannica.com/search?query=',
  'https://www.infoplease.com/search/',
  'https://www.britannica.co.uk/',
  'https://kids.britannica.com/search?query=',
  'https://www.reference.com/search?q=',
  'https://www.factmonster.com/search?query=',
  'https://www.encyclopedia.com/search?query=',
  'https://www.worldbookonline.com/kids/home#search/k/',
  'https://biography.com/search?q=',
  'https://www.bbc.com/search?q=',
  'https://edition.cnn.com/search?q=',
  'https://www.reuters.com/site-search/?query=',
  'https://www.nytimes.com/search?query=',
  'https://www.aljazeera.com/search/?q=',
  'https://www.theguardian.com/search?q=',
  'https://apnews.com/search/',
  'https://www.usatoday.com/search/?q=',
  'https://www.axios.com/search?q=',
  'https://www.politico.com/search/?q=',
  'https://stackoverflow.com/search?q=',
  'https://www.reddit.com/search/?q=',
  'https://www.quora.com/search?q=',
  'https://answers.yahoo.com/dir/index?sid=&q=',
  'https://community.spiceworks.com/search?key=',
  'https://forums.tomshardware.com/search/search?keywords=',
  'https://www.healthboards.com/search?q=',
  'https://discourse.mozilla.org/search?q=',
  'https://community.adobe.com/search?q=',
  'https://community.spotify.com/search?q=',
  'https://www.merriam-webster.com/dictionary/',
  'https://dictionary.cambridge.org/dictionary/english/',
  'https://www.oxfordlearnersdictionaries.com/definition/english/',
  'https://www.collinsdictionary.com/dictionary/english/',
  'https://www.vocabulary.com/dictionary/',
  'https://www.macmillandictionary.com/dictionary/british/',
  'https://www.ldoceonline.com/dictionary/',
  'https://www.ahdictionary.com/word/search.html?q=',
  'https://www.yourdictionary.com/',
  'https://www.thefreedictionary.com/',
  'https://www.gutenberg.org/ebooks/search/?query=',
  'https://openlibrary.org/search?q=',
  'https://www.goodreads.com/search?q=',
  'https://books.google.com/books?q=',
  'https://archive.org/search.php?query=',
  'https://www.worldcat.org/search?q=',
  'https://www.sparknotes.com/search/?q=',
  'https://www.cliffsnotes.com/search?search=',
  'https://en.wikipedia.org/wiki/Portal:Literature',
  'https://manybooks.net/search-books.php?keyword=',
  'https://www.khanacademy.org/search?page_search_query=',
  'https://www.tutorialspoint.com/index.php?search=',
  'https://www.geeksforgeeks.org/?s=',
  'https://www.w3schools.com/howto/howto_js_search_menu.asp?q=',
  'https://www.coursera.org/search?query=',
  'https://www.udemy.com/courses/search/?q=',
  'https://www.edx.org/search?q=',
  'https://www.codecademy.com/search?q=',
  'https://www.freecodecamp.org/news/?s=',
  'https://stackoverflow.com/search?q=',
  'https://www.sciencedaily.com/search/?keyword=',
  'https://scholar.google.com/scholar?q=',
  'https://arxiv.org/search/?query=',
  'https://pubmed.ncbi.nlm.nih.gov/?term=',
  'https://www.nature.com/search?q=',
  'https://www.sciencemag.org/search/',
  'https://phys.org/search/',
  'https://www.newscientist.com/search/?s=',
  'https://www.insidescience.org/search?keys=',
  'https://www.biorxiv.org/search/',
  'https://www.investopedia.com/search?q=',
  'https://www.marketwatch.com/search?q=',
  'https://www.bloomberg.com/search?query=',
  'https://finance.yahoo.com/search?q=',
  'https://www.reuters.com/finance',
  'https://www.wsj.com/search?query=',
  'https://www.ft.com/search?q=',
  'https://www.investing.com/search/?q=',
  'https://www.nasdaq.com/search?query=',
  'https://www.cnbc.com/search/?query=',
  'https://www.webmd.com/search/search_results/default.aspx?query=',
  'https://www.mayoclinic.org/search/search-results?q=',
  'https://www.healthline.com/search?q=',
  'https://www.medicalnewstoday.com/search?q=',
  'https://www.cdc.gov/search/results?query=',
  'https://www.who.int/news-room/questions-and-answers?search=',
  'https://www.nih.gov/search?keys=',
  'https://sermo.com/search?q=',
  'https://patient.info/search?q=',
  'https://pubmed.ncbi.nlm.nih.gov/?term=',
  'https://www.lonelyplanet.com/search?q=',
  'https://www.tripadvisor.com/Search?q=',
  'https://www.booking.com/searchresults.html?ss=',
  'https://www.airbnb.com/s/',
  'https://www.expedia.com/Hotel-Search?',
  'https://www.nationalgeographic.com/search?q=',
  'https://www.worldatlas.com/search?q=',
  'https://www.travelandleisure.com/search?q=',
  'https://www.jetsetter.com/search?q=',
  'https://www.skyscanner.com/search?q=',
  'https://www.allrecipes.com/search/results/?search=',
  'https://www.foodnetwork.com/search/',
  'https://www.epicurious.com/search/',
  'https://www.bbcgoodfood.com/search/recipes?q=',
  'https://www.simplyrecipes.com/search?q=',
  'https://www.jamieoliver.com/search/?q=',
  'https://www.skinnytaste.com/?s=',
  'https://www.seriouseats.com/search?term=',
  'https://www.delish.com/search/?q=',
  'https://www.thekitchn.com/search?q=',
  'https://www.espn.com/search/results?q=',
  'https://www.bbc.co.uk/sport/search?q=',
  'https://www.goal.com/en/search/',
  'https://www.skysports.com/search?q=',
  'https://www.sports.yahoo.com/search/',
  'https://www.cbssports.com/search/results/?q=',
  'https://www.nfl.com/search/?query=',
  'https://www.nba.com/search/?q=',
  'https://www.mlssoccer.com/search?q=',
  'https://www.formula1.com/en/search.html?query=',
  'https://www.imdb.com/find?q=',
  'https://www.rottentomatoes.com/search?search=',
  'https://www.metacritic.com/search/all/',
  'https://www.boxofficemojo.com/search/?q=',
  'https://www.allmovie.com/search?q=',
  'https://www.themoviedb.org/search?query=',
  'https://www.tvguide.com/search/?q=',
  'https://variety.com/v/search/',
  'https://hollywoodreporter.com/?s=',
  'https://www.fandango.com/search?q=',
  'https://www.lyrics.com/serp.php?st=',
  'https://www.azlyrics.com/search.php?q=',
  'https://genius.com/search?q=',
  'https://www.songmeanings.com/query/?action=search&search=',
  'https://musicbrainz.org/search?query=',
  'https://www.last.fm/search?q=',
  'https://www.allmusic.com/search?q=',
  'https://www.billboard.com/search/?q=',
  'https://www.soundcloud.com/search?q=',
  'https://www.pandora.com/search/',
  'https://unsplash.com/s/photos/',
  'https://pixabay.com/images/search/',
  'https://www.pexels.com/search/',
  'https://www.flickr.com/search/?text=',
  'https://images.search.yahoo.com/search/images?p=',
  'https://www.istockphoto.com/search/2/image?phrase=',
  'https://stock.adobe.com/search?k=',
  'https://www.shutterstock.com/search/',
  'https://www.gettyimages.com/photos/',
  'https://www.500px.com/search?q='
];

// Detect simple category types
function detectCategories(text) {
  const categories = [];
  const lower = text.toLowerCase();
  if (lower.includes('forum') || lower.includes('discussion')) categories.push('forums');
  if (lower.includes('news') || lower.includes('breaking') || lower.includes('headline')) categories.push('news');
  if (lower.includes('book') || lower.includes('novel') || lower.includes('published')) categories.push('books');
  return categories;
}

async function getImagesAndCategories(wikiUrl) {
  try {
    const htmlRes = await axios.get(wikiUrl);
    const $ = cheerio.load(htmlRes.data);
    const rawText = $('body').text();
    const categories = detectCategories(rawText);
    const images = [];
    $('#mw-content-text img').each((_, el) => {
      const src = $(el).attr('src') || '';
      if (images.length < 20 && src && !src.includes('icon') && !src.includes('logo')) {
        const fullSrc = src.startsWith('http') ? src : `https:${src}`;
        images.push(fullSrc);
      }
    });
    return { images, categories };
  } catch (err) {
    console.error(`❌ Error scraping article: ${err.message}`);
    return { images: [], categories: [] };
  }
}

app.post('/search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Missing query.' });

  const aiData = await getAnswer(query);
  if (!aiData) {
    return res.json({
      response: `❌ Couldn't find anything for "${query}"`,
      related: [],
      images: [],
      categories: [],
      source: null
    });
  }

  let images = [];
  let categories = [];

  if (aiData.sourceName === 'Wikipedia') {
    const data = await getImagesAndCategories(aiData.source);
    images = data.images;
    categories = data.categories;
  } else if (aiData.sourceName === 'DuckDuckGo' && aiData.image) {
    images = [aiData.image];
  }

  res.json({
    response: aiData.main,
    related: [],
    images,
    title: aiData.title,
    source: aiData.source,
    categories
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Fserver running on port ${PORT}`);
});
