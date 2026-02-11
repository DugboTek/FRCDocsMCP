import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import MiniSearch from "minisearch";
import { Library } from "../shared/constants.js";
import type { DocPage } from "../shared/types.js";
import { discoverUrls } from "./crawler.js";
import { extractContent } from "./extractor.js";
import { extractWPILibDocs } from "./wpilib-source.js";

function log(msg: string) {
  process.stderr.write(`[scraper] ${msg}\n`);
}

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function scrape() {
  const allPages: DocPage[] = [];

  for (const library of Object.values(Library)) {
    log(`\n=== Processing ${library} ===`);

    if (library === Library.WPILib) {
      // WPILib: pull directly from GitHub RST source files
      log("Extracting from GitHub repo (RST → Markdown)...");
      const pages = await extractWPILibDocs();
      allPages.push(...pages);
      log(`${library}: ${pages.length} pages extracted from source`);
    } else {
      // CTRE & AdvantageKit: discover URLs and extract via Gemini
      log("Discovering URLs...");
      const urls = await discoverUrls(library);
      log(`Found ${urls.length} URLs`);

      log("Extracting content via Gemini...");
      const pages = await extractContent(urls, library);
      allPages.push(...pages);
      log(`${library}: ${pages.length} pages extracted`);
    }
  }

  log(`\n=== Building index ===`);
  log(`Total pages: ${allPages.length}`);

  // Build MiniSearch index
  const miniSearch = new MiniSearch<DocPage>({
    fields: ["title", "content"],
    storeFields: ["title", "url", "library"],
    searchOptions: {
      boost: { title: 3 },
      fuzzy: 0.2,
      prefix: true,
    },
  });

  miniSearch.addAll(allPages);

  // Serialize to docs.json
  const bundle = {
    pages: allPages,
    index: miniSearch.toJSON(),
    metadata: {
      generatedAt: new Date().toISOString(),
      totalPages: allPages.length,
      totalTokens: allPages.reduce((sum, p) => sum + p.tokens, 0),
      libraries: Object.values(Library).map((lib) => ({
        name: lib,
        pages: allPages.filter((p) => p.library === lib).length,
      })),
    },
  };

  const outPath = resolve(__dirname, "../../data/docs.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(bundle));

  log(`\nBundle written to ${outPath}`);
  log(`Total size: ${(Buffer.byteLength(JSON.stringify(bundle)) / 1024 / 1024).toFixed(2)} MB`);
  log(`Total tokens: ${bundle.metadata.totalTokens.toLocaleString()}`);
  for (const lib of bundle.metadata.libraries) {
    log(`  ${lib.name}: ${lib.pages} pages`);
  }
}

// Allow running directly
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\//, ""))) {
  scrape().catch((err) => {
    process.stderr.write(`Fatal error: ${err}\n`);
    process.exit(1);
  });
}
