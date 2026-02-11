/**
 * Post-processes docs.json to fix quality issues without re-scraping.
 * Run with: node dist/scraper/postprocess.js
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import MiniSearch from "minisearch";
import type { DocPage } from "../shared/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function log(msg: string) {
  process.stderr.write(`[postprocess] ${msg}\n`);
}

function extractTitle(markdown: string, url: string): string {
  // Try # heading, then ## heading
  const h1 = markdown.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();

  const h2 = markdown.match(/^##\s+(.+)$/m);
  if (h2) return h2[1].trim();

  // Try bold text at start
  const bold = markdown.match(/^\*\*(.+?)\*\*/m);
  if (bold) return bold[1].trim();

  // Fallback: derive from URL
  const slug = url.split("/").filter(Boolean).pop() || "";
  return slug
    .replace(/\.html?$/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isJunkPage(page: DocPage): boolean {
  // Filter 404 pages
  if (page.title.match(/page not found/i)) return true;
  if (page.content.match(/^#\s+page not found/im)) return true;

  // Filter search-only pages
  if (page.title === "Search the documentation") return true;

  // Filter pages with raw HTML (bad conversion)
  if (page.content.includes("<form") && page.tokens < 200) return true;

  return false;
}

function isToctreeStub(page: DocPage): boolean {
  // WPILib pages that are just toctree listings (only heading + list of paths)
  if (page.library !== "WPILib") return false;
  if (page.tokens > 60) return false;

  const lines = page.content.split("\n").filter((l) => l.trim());
  // If most lines are just paths/filenames (no actual content)
  const pathLines = lines.filter((l) => l.trim().match(/^[\w\/-]+$/));
  return pathLines.length > lines.length * 0.5;
}

const docsPath = resolve(__dirname, "../../data/docs.json");
log(`Loading ${docsPath}`);

const raw = readFileSync(docsPath, "utf-8");
const data = JSON.parse(raw);

let originalCount = data.pages.length;
let fixedTitles = 0;
let removedJunk = 0;
let removedStubs = 0;
let cleanedOrphan = 0;

// Process pages
const cleanedPages: DocPage[] = [];

for (const page of data.pages as DocPage[]) {
  // Clean :orphan: from WPILib content
  if (page.library === "WPILib" && page.content.startsWith(":orphan:")) {
    page.content = page.content.replace(/^:orphan:\s*\n*/, "").trim();
    cleanedOrphan++;
  }

  // Filter junk pages
  if (isJunkPage(page)) {
    log(`  Removing junk: "${page.title}" (${page.library})`);
    removedJunk++;
    continue;
  }

  // Filter toctree stubs
  if (isToctreeStub(page)) {
    log(`  Removing stub: "${page.title}" (${page.library})`);
    removedStubs++;
    continue;
  }

  // Fix untitled pages
  if (page.title === "Untitled") {
    const newTitle = extractTitle(page.content, page.url);
    if (newTitle !== "Untitled") {
      page.title = newTitle;
      fixedTitles++;
    }
  }

  // Recalculate tokens after content changes
  page.tokens = Math.ceil(page.content.length / 4);

  cleanedPages.push(page);
}

log(`\n=== Results ===`);
log(`Original pages: ${originalCount}`);
log(`Fixed titles: ${fixedTitles}`);
log(`Removed junk: ${removedJunk}`);
log(`Removed stubs: ${removedStubs}`);
log(`Cleaned :orphan:: ${cleanedOrphan}`);
log(`Final pages: ${cleanedPages.length}`);

// Check remaining untitled
const stillUntitled = cleanedPages.filter((p) => p.title === "Untitled");
log(`Still untitled: ${stillUntitled.length}`);
if (stillUntitled.length > 0) {
  for (const p of stillUntitled.slice(0, 5)) {
    log(`  - ${p.url} (${p.tokens} tok): ${p.content.split("\n")[0].slice(0, 80)}`);
  }
}

// Rebuild MiniSearch index
log(`\nRebuilding MiniSearch index...`);
const miniSearch = new MiniSearch<DocPage>({
  fields: ["title", "content"],
  storeFields: ["title", "url", "library"],
  searchOptions: {
    boost: { title: 3 },
    fuzzy: 0.2,
    prefix: true,
  },
});
miniSearch.addAll(cleanedPages);

// Write updated bundle
const bundle = {
  pages: cleanedPages,
  index: miniSearch.toJSON(),
  metadata: {
    generatedAt: new Date().toISOString(),
    totalPages: cleanedPages.length,
    totalTokens: cleanedPages.reduce((sum, p) => sum + p.tokens, 0),
    libraries: [...new Set(cleanedPages.map((p) => p.library))].map((lib) => ({
      name: lib,
      pages: cleanedPages.filter((p) => p.library === lib).length,
    })),
  },
};

writeFileSync(docsPath, JSON.stringify(bundle));
log(`\nBundle written: ${(Buffer.byteLength(JSON.stringify(bundle)) / 1024 / 1024).toFixed(2)} MB`);
log(`Total tokens: ${bundle.metadata.totalTokens.toLocaleString()}`);
for (const lib of bundle.metadata.libraries) {
  log(`  ${lib.name}: ${lib.pages} pages`);
}
