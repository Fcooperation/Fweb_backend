// sites.js
export const sourceCategories = {
  general: [
    (q) => `https://en.wikipedia.org/wiki/${encodeURIComponent(q)}`,
    (q) => `https://www.britannica.com/search?query=${encodeURIComponent(q)}`,
    (q) => `https://www.quora.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.infoplease.com/search/${encodeURIComponent(q)}`,
    (q) => `https://www.bbc.co.uk/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.theguardian.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.nationalgeographic.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.npr.org/search?query=${encodeURIComponent(q)}`,
    (q) => `https://www.history.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(q)}`,
    (q) => `https://www.sabcnews.com/sabcsearch/?q=${encodeURIComponent(q)}`,
    (q) => `https://www.vanguardngr.com/?s=${encodeURIComponent(q)}`,
    (q) => `https://www.premiumtimesng.com/search?q=${encodeURIComponent(q)}`
  ],
  tech: [
    (q) => `https://techcrunch.com/search/${encodeURIComponent(q)}`,
    (q) => `https://www.theverge.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.zdnet.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://arstechnica.com/search/?query=${encodeURIComponent(q)}`,
    (q) => `https://techpoint.africa/search/?q=${encodeURIComponent(q)}`,
    (q) => `https://www.techweez.com/?s=${encodeURIComponent(q)}`
  ],
  science: [
    (q) => `https://www.nature.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.scientificamerican.com/search/?q=${encodeURIComponent(q)}`,
    (q) => `https://www.sciencenews.org/?s=${encodeURIComponent(q)}`,
    (q) => `https://www.livescience.com/search?searchTerm=${encodeURIComponent(q)}`,
    (q) => `https://www.health24.com/Search?query=${encodeURIComponent(q)}`
  ],
  education: [
    (q) => `https://plato.stanford.edu/search/searcher.py?query=${encodeURIComponent(q)}`,
    (q) => `https://scholar.google.com/scholar?q=${encodeURIComponent(q)}`,
    (q) => `https://quizlet.com/subject/${encodeURIComponent(q)}`,
    (q) => `https://eric.ed.gov/?q=${encodeURIComponent(q)}`,
    (q) => `https://www.nou.edu.ng/search/node/${encodeURIComponent(q)}`
  ]
};
