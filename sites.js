// sites.js

export const sourceCategories = {
  general: [
    query => `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,          // Wikipedia
    query => `https://www.britannica.com/search?query=${encodeURIComponent(query)}`, // Britannica
    query => `https://www.dictionary.com/browse/${encodeURIComponent(query)}`,       // Dictionary.com
    query => `https://www.merriam-webster.com/dictionary/${encodeURIComponent(query)}`, // Merriam-Webster
    query => `https://www.collinsdictionary.com/dictionary/english/${encodeURIComponent(query)}`, // Collins
    query => `https://www.studystack.com/search?q=${encodeURIComponent(query)}`,    // Study.com
    query => `https://www.thoughtco.com/search?q=${encodeURIComponent(query)}`,    // ThoughtCo
    query => `https://www.techopedia.com/search?q=${encodeURIComponent(query)}`,   // Techopedia
    query => `https://www.howstuffworks.com/search?q=${encodeURIComponent(query)}`,// HowStuffWorks
    query => `https://www.sciencedaily.com/search/?q=${encodeURIComponent(query)}`,// ScienceDaily
    query => `https://www.nationalgeographic.com/search?q=${encodeURIComponent(query)}`, // National Geographic
    query => `https://www.investopedia.com/search?q=${encodeURIComponent(query)}`,  // Investopedia
    query => `https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(query)}`, // Khan Academy
    query => `https://www.edx.org/search?q=${encodeURIComponent(query)}`,           // edX
    query => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,          // Bing
    query => `https://www.google.com/search?q=${encodeURIComponent(query)}`,        // Google
    query => `https://www.cambridge.org/dictionary/english/${encodeURIComponent(query)}`, // Cambridge Dictionary
    query => `https://plato.stanford.edu/search/search.html?query=${encodeURIComponent(query)}`, // Stanford Encyclopedia
    query => `https://simple.wikipedia.org/wiki/${encodeURIComponent(query)}`,      // Simple Wikipedia
    query => `https://kids.britannica.com/search?query=${encodeURIComponent(query)}`// Britannica Kids
  ]
};
