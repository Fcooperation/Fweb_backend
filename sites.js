// sites.js

export const sourceCategories = {
  general: [
    query => `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,        // ✅ Wikipedia
    query => `https://www.britannica.com/search?query=${encodeURIComponent(query)}`, // ✅ Britannica
    query => `https://www.dictionary.com/browse/${encodeURIComponent(query)}`,
    query => `https://www.merriam-webster.com/dictionary/${encodeURIComponent(query)}`,
    query => `https://www.techopedia.com/search?q=${encodeURIComponent(query)}`,
    query => `https://www.howstuffworks.com/search?q=${encodeURIComponent(query)}`,
    query => `https://www.sciencedaily.com/search/?q=${encodeURIComponent(query)}`,
    query => `https://www.nationalgeographic.com/search?q=${encodeURIComponent(query)}`,
    query => `https://www.investopedia.com/search?q=${encodeURIComponent(query)}`,
    query => `https://www.thoughtco.com/search?q=${encodeURIComponent(query)}`
  ]
};
