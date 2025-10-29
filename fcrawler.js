import { handleNormalSearch } from "./fcrawler2.js";
import { handleDefinitionSearch } from "./fcrawler3.js";
import { definitionWords } from "./definitionWords.js";
import fetch from "node-fetch";

/**
 * Handles any query and classifies it as:
 * - Link search (with site check)
 * - Definition search
 * - Normal search
 */
export async function handleSearch(query) {
  const isLink = /^https?:\/\/|^[\w-]+\.[a-z]{2,}/i.test(query);

  // --------------------------------------------
  // 🔹 LINK SEARCH HANDLING
  // --------------------------------------------
  if (isLink) {
    const url = query.startsWith("http") ? query : "https://" + query;

    try {
      const response = await fetch(url, { method: "HEAD", timeout: 5000 });

      if (response.ok) {
        return [
          {
            title: "Valid Website",
            url,
            snippet: `✅ The site "${url}" exists and is reachable.`,
            html: null,
            type: "link",
          },
        ];
      } else {
        return [
          {
            title: "Site Unreachable",
            url,
            snippet: `⚠️ The site "${url}" could not be reached (status ${response.status}).`,
            html: null,
            type: "link-error",
          },
        ];
      }
    } catch (err) {
      return [
        {
          title: "Site Does Not Exist",
          url,
          snippet: `❌ The site "${url}" does not exist or refused connection.`,
          html: null,
          type: "link-error",
        },
      ];
    }
  }

  // --------------------------------------------
  // 🔹 NORMAL SEARCH HANDLING
  // --------------------------------------------
  const queryLower = query.trim().toLowerCase();

  // Check if query starts with any definition keyword
  const isDefinitionSearch = definitionWords.some((word) =>
    queryLower.startsWith(word.toLowerCase())
  );

  if (isDefinitionSearch) {
    console.log("📘 Definition-type search detected.");
    return await handleDefinitionSearch(query);
  }

  // Normal search
  console.log("🌍 Normal search detected.");
  return await handleNormalSearch(query);
}
