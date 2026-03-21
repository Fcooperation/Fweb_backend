import { handleSearch } from "./fcrawler.js";

/**
 * FAI = AI summary powered by Fserver results
 * @param {string} query
 */
export async function fetchFAI(query) {
  if (!query) throw new Error("❌ No query provided to FAI");

  try {
    // 1️⃣ Get results from your search engine
    const results = await handleSearch(query);

    if (!results || results.length === 0) {
      return {
        answer: "No results found.",
        links: []
      };
    }

    // 2️⃣ Extract useful snippets
    const snippets = results
      .map(r => r.snippet)
      .filter(Boolean)
      .slice(0, 5);

    // 3️⃣ Clean + merge into AI-like response
    let answer = snippets.join(" ");

    // Optional cleanup (makes it look smarter 👀)
    answer = answer
      .replace(/\s+/g, " ")
      .replace(/(\.\s*)+/g, ". ")
      .trim();

    // 4️⃣ Prepare links (reuse your results)
    const links = results.slice(0, 5).map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet,
      favicon: `https://www.google.com/s2/favicons?domain=${r.url}`
    }));

    return { answer, links };

  } catch (err) {
    console.error("❌ FAI error:", err.message);

    return {
      answer: "AI could not generate response.",
      links: []
    };
  }
              }
