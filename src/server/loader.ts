import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import MiniSearch from "minisearch";
import type { DocPage } from "../shared/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface DocsBundle {
  miniSearch: MiniSearch<DocPage>;
  pages: Map<string, DocPage>;
  metadata: {
    generatedAt: string;
    totalPages: number;
    totalTokens: number;
    libraries: Array<{ name: string; pages: number }>;
  };
}

export function loadDocs(): DocsBundle {
  const docsPath = resolve(__dirname, "../../data/docs.json");

  process.stderr.write(`[loader] Loading docs from ${docsPath}\n`);

  const raw = readFileSync(docsPath, "utf-8");
  const data = JSON.parse(raw);

  // Reconstruct MiniSearch from serialized index
  const miniSearch = MiniSearch.loadJSON<DocPage>(JSON.stringify(data.index), {
    fields: ["title", "content"],
    storeFields: ["title", "url", "library"],
    searchOptions: {
      boost: { title: 3 },
      fuzzy: 0.2,
      prefix: true,
    },
  });

  // Build id→page map
  const pages = new Map<string, DocPage>();
  for (const page of data.pages) {
    pages.set(page.id, page);
  }

  process.stderr.write(
    `[loader] Loaded ${pages.size} pages, index ready\n`
  );

  return {
    miniSearch,
    pages,
    metadata: data.metadata,
  };
}
