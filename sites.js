// sites.js

export const sourceCategories = {
  general: [
    query => `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,                         // Wik
    query => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,                         // Bing
    query => `https://www.collinsdictionary.com/dictionary/english/${encodeURIComponent(query)}`,   // Collins Dictionary
    query => `https://www.merriam-webster.com/dictionary/${encodeURIComponent(query)}`,             // Merriam-Webster
    query => `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(query)}`,    // Cambridge Dictionary
    query => `https://www.britannica.com/search?query=${encodeURIComponent(query)}`,                // Britannica
    query => `https://artsandculture.google.com/search?q=${encodeURIComponent(query)}`,             // Google Arts & Culture
    query => `https://kids.britannica.com/search?query=${encodeURIComponent(query)}`,               // Britannica Kids
    query => `https://www.nationalgeographic.org/search/?q=${encodeURIComponent(query)}`,           // National Geographic Society
    query => `https://www.vocabulary.com/dictionary/${encodeURIComponent(query)}`,                  // Vocabulary
    query => `https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(query)}`, // Oxford Dictionary
    query => `https://www.bbc.co.uk/search?q=${encodeURIComponent(query)}`,                         // BBC
    query => `https://www.metoffice.gov.uk/search/site/${encodeURIComponent(query)}`,               // Met Office
    query => `https://www.timeanddate.com/search/results.html?query=${encodeURIComponent(query)}`,  // Time and Date
    query => `https://www.accuweather.com/en/search-locations?query=${encodeURIComponent(query)}`,  // AccuWeather
    query => `https://www.techadvisor.com/search/?q=${encodeURIComponent(query)}`,                  // Tech Advisor
    query => `https://www.techradar.com/search?searchTerm=${encodeURIComponent(query)}`,            // TechRadar
    query => `https://www.espn.com/search/_/q/${encodeURIComponent(query)}`,                        // ESPN
    query => `https://www.si.com/search?q=${encodeURIComponent(query)}`,                            // Sports Illustrated
    query => `https://www.google.com/search?q=${encodeURIComponent(query)}`                         // Google
  ]
};
