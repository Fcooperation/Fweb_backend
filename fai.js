import fetch from "node-fetch";

/**
 * Fetch AI-like answer using Wikipedia
 * @param {string} query
 */
export async function fetchFAI(query) {
  if (!query) throw new Error("❌ No query provided to FAI");

  try {
    // 1️⃣ Search Wikipedia
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`
    );

    const searchData = await searchRes.json();

    const firstResult = searchData?.query?.search?.[0];

    if (!firstResult) {
      return {
        answer: "No relevant information found on Wikipedia.",
        links: []
      };
    }

    const title = firstResult.title;

    // 2️⃣ Get page summary (extract)
    const summaryRes = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
    );

    const summaryData = await summaryRes.json();

    const answer =
      summaryData.extract ||
      "No summary available.";

    // 3️⃣ Build links (real this time 🔥)
    const links = [
      {
        title: summaryData.title,
        url: summaryData.content_urls?.desktop?.page,
        snippet: answer.substring(0, 120) + "...",
        favicon: "https://www.wikipedia.org/static/favicon/wikipedia.ico",
      },
      {
        title: `Search more about "${query}"`,
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        snippet: `Explore more results for ${query}`,
        favicon: "https://www.google.com/favicon.ico",
      }
    ];

    return { answer, links };

  } catch (err) {
    console.error("❌ FAI Wiki error:", err.message);

    return {
      answer: "No AI response available",
      links: [
        {
          title: "Search on Google",
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          snippet: "See more results",
          favicon: "https://www.google.com/favicon.ico",
        },
      ],
    };
  }
      }
