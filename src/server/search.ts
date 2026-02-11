import type { DocsBundle } from "./loader.js";
import type { SearchResult } from "../shared/types.js";

export function searchDocs(
  bundle: DocsBundle,
  query: string,
  library?: string,
  limit: number = 10
): SearchResult[] {
  let results = bundle.miniSearch.search(query, {
    boost: { title: 3 },
    fuzzy: 0.2,
    prefix: true,
  });

  // Filter by library if specified
  if (library) {
    results = results.filter((r) => {
      const stored = r as unknown as { library: string };
      return stored.library === library;
    });
  }

  // Limit results
  results = results.slice(0, limit);

  return results.map((r) => {
    const stored = r as unknown as {
      title: string;
      url: string;
      library: string;
    };
    const page = bundle.pages.get(r.id as string);

    // Generate snippet from content
    let snippet = "";
    if (page) {
      const lowerContent = page.content.toLowerCase();
      const lowerQuery = query.toLowerCase();
      const idx = lowerContent.indexOf(lowerQuery);

      if (idx !== -1) {
        const start = Math.max(0, idx - 80);
        const end = Math.min(page.content.length, idx + lowerQuery.length + 120);
        snippet = (start > 0 ? "..." : "") + page.content.slice(start, end).trim() + (end < page.content.length ? "..." : "");
      } else {
        // Use the beginning of the content
        snippet = page.content.slice(0, 200).trim() + "...";
      }
    }

    return {
      id: r.id as string,
      title: stored.title || "Untitled",
      snippet,
      url: stored.url || "",
      library: stored.library || "",
      score: r.score,
    };
  });
}
