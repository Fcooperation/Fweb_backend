// sites.js

export const sourceCategories = {
  general: [
    query => `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}` // ✅ Wikipedia only
  ]
};
