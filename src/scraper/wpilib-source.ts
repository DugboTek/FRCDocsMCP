import { execSync } from "node:child_process";
import { readFileSync, existsSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import type { DocPage } from "../shared/types.js";
import { Library, BASE_URLS } from "../shared/constants.js";
import { rstToMarkdown } from "./rst-converter.js";

function log(msg: string) {
  process.stderr.write(`[wpilib-source] ${msg}\n`);
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function findRstFiles(dir: string): string[] {
  const result = execSync(`find "${dir}" -name "*.rst" -type f`, {
    encoding: "utf-8",
  });
  return result
    .trim()
    .split("\n")
    .filter((f) => f.length > 0);
}

export async function extractWPILibDocs(): Promise<DocPage[]> {
  const cloneDir = join(tmpdir(), "frc-docs-mcp-clone");
  const repoUrl = "https://github.com/wpilibsuite/frc-docs.git";
  const baseUrl = BASE_URLS[Library.WPILib];

  // Clean up any previous clone
  if (existsSync(cloneDir)) {
    rmSync(cloneDir, { recursive: true, force: true });
  }

  log(`Cloning ${repoUrl} (shallow)...`);
  execSync(`git clone --depth 1 "${repoUrl}" "${cloneDir}"`, {
    stdio: "pipe",
  });

  const sourceDir = join(cloneDir, "source");
  if (!existsSync(sourceDir)) {
    throw new Error("source/ directory not found in frc-docs repo");
  }

  const rstFiles = findRstFiles(sourceDir);
  log(`Found ${rstFiles.length} RST files`);

  const pages: DocPage[] = [];
  let skipped = 0;

  for (const filePath of rstFiles) {
    try {
      const rst = readFileSync(filePath, "utf-8");

      // Skip very short files (stubs, index-only)
      if (rst.trim().length < 100) {
        skipped++;
        continue;
      }

      const markdown = rstToMarkdown(rst);

      // Skip if conversion produced very little content
      if (markdown.trim().length < 50) {
        skipped++;
        continue;
      }

      // Build the URL from the relative path
      const relPath = relative(sourceDir, filePath)
        .replace(/\.rst$/, ".html");
      const url = `${baseUrl}/${relPath}`;

      // Build a stable ID
      const id = `wpilib_${relPath.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_")}`;

      // Extract title from first heading
      const titleMatch = markdown.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : relPath.replace(/\.html$/, "").split("/").pop() || "Untitled";

      pages.push({
        id,
        title,
        library: Library.WPILib,
        url,
        content: markdown,
        tokens: estimateTokens(markdown),
      });
    } catch (err) {
      log(`  Error processing ${filePath}: ${err}`);
    }
  }

  // Cleanup
  try {
    rmSync(cloneDir, { recursive: true, force: true });
  } catch {
    // Best effort cleanup
  }

  log(`Extracted ${pages.length} pages (${skipped} skipped)`);
  return pages;
}
