// fcrawler.js

// Function to check if query is a link or normal text
export function handleSearch(query) {
  const isLink = /^https?:\/\/|^[\w-]+\.[a-z]{2,}/i.test(query);

  if (isLink) {
    return [
      {
        title: "Detected Link",
        url: query.startsWith("http") ? query : "https://" + query,
        snippet: "This search input looks like a website link."
      }
    ];
  } else {
    return [
      {
        title: "Detected Normal Search",
        url: "https://www.google.com/search?q=" + encodeURIComponent(query),
        snippet: "This search input looks like a normal search query."
      }
    ];
  }
}
