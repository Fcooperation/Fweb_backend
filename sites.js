// sites.js
// 🔹 Trusted sources grouped by category

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

    // 🔹 African general sources
    (q) => `https://www.sabcnews.com/sabcsearch/?q=${encodeURIComponent(q)}`,
    (q) => `https://www.timeslive.co.za/search/?q=${encodeURIComponent(q)}`,
    (q) => `https://www.news24.com/search?query=${encodeURIComponent(q)}`,
    (q) => `https://www.ghanaweb.com/Search/?q=${encodeURIComponent(q)}`,
    (q) => `https://www.vanguardngr.com/?s=${encodeURIComponent(q)}`,
    (q) => `https://www.dailytrust.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.thisdaylive.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.premiumtimesng.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.thecitizen.co.tz/search/?q=${encodeURIComponent(q)}`,
    (q) => `https://www.nation.africa/search?search=${encodeURIComponent(q)}`
  ],

  tech: [
    (q) => `https://techcrunch.com/search/${encodeURIComponent(q)}`,
    (q) => `https://www.theverge.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.howtogeek.com/search/${encodeURIComponent(q)}`,
    (q) => `https://www.makeuseof.com/?s=${encodeURIComponent(q)}`,
    (q) => `https://www.zdnet.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.wired.com/search/?q=${encodeURIComponent(q)}`,
    (q) => `https://www.digitaltrends.com/?s=${encodeURIComponent(q)}`,
    (q) => `https://www.tomshardware.com/search?searchTerm=${encodeURIComponent(q)}`,
    (q) => `https://arstechnica.com/search/?query=${encodeURIComponent(q)}`,
    (q) => `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(q)}`,

    // 🔹 African tech sources
    (q) => `https://techpoint.africa/search/?q=${encodeURIComponent(q)}`,
    (q) => `https://www.techzim.co.zw/?s=${encodeURIComponent(q)}`,
    (q) => `https://www.itweb.co.za/search-results/?q=${encodeURIComponent(q)}`,
    (q) => `https://www.businessdailyafrica.com/search/?q=${encodeURIComponent(q)}`,
    (q) => `https://www.techweez.com/?s=${encodeURIComponent(q)}`
  ],

  science: [
    (q) => `https://www.nature.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.scientificamerican.com/search/?q=${encodeURIComponent(q)}`,
    (q) => `https://www.space.com/search?searchTerm=${encodeURIComponent(q)}`,
    (q) => `https://www.sciencenews.org/?s=${encodeURIComponent(q)}`,
    (q) => `https://www.livescience.com/search?searchTerm=${encodeURIComponent(q)}`,
    (q) => `https://www.nih.gov/search?query=${encodeURIComponent(q)}`,
    (q) => `https://www.mayoclinic.org/search/search-results?q=${encodeURIComponent(q)}`,
    (q) => `https://www.healthline.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.webmd.com/search/search_results/default.aspx?query=${encodeURIComponent(q)}`,
    (q) => `https://www.nationalgeographic.com/science/search?q=${encodeURIComponent(q)}`,

    // 🔹 African science / health
    (q) => `https://www.ajol.info/index.php/ajol/search/search?query=${encodeURIComponent(q)}`,
    (q) => `https://www.health24.com/Search?query=${encodeURIComponent(q)}`,
    (q) => `https://www.medicalbrief.co.za/?s=${encodeURIComponent(q)}`,
    (q) => `https://www.ghanahealthservice.org/search.php?q=${encodeURIComponent(q)}`
  ],

  education: [
    (q) => `https://plato.stanford.edu/search/searcher.py?query=${encodeURIComponent(q)}`,
    (q) => `https://www.jstor.org/action/doBasicSearch?Query=${encodeURIComponent(q)}`,
    (q) => `https://scholar.google.com/scholar?q=${encodeURIComponent(q)}`,
    (q) => `https://www.coursehero.com/search/?q=${encodeURIComponent(q)}`,
    (q) => `https://quizlet.com/subject/${encodeURIComponent(q)}`,
    (q) => `https://www.sparknotes.com/search?q=${encodeURIComponent(q)}`,
    (q) => `https://www.ck12.org/search/?q=${encodeURIComponent(q)}`,
    (q) => `https://eric.ed.gov/?q=${encodeURIComponent(q)}`,
    (q) => `https://ocw.mit.edu/search/?q=${encodeURIComponent(q)}`,
    (q) => `https://www.edx.org/search?q=${encodeURIComponent(q)}`,

    // 🔹 African education sources
    (q) => `https://www.nou.edu.ng/search/node/${encodeURIComponent(q)}`,
    (q) => `https://www.unisa.ac.za/sites/corporate/default/Search-Results?query=${encodeURIComponent(q)}`,
    (q) => `https://www.uct.ac.za/search?search_api_fulltext=${encodeURIComponent(q)}`,
    (q) => `https://www.ug.edu.gh/search/node/${encodeURIComponent(q)}`,
    (q) => `https://www.ku.ac.ke/search?search_api_fulltext=${encodeURIComponent(q)}`
  ]
};
