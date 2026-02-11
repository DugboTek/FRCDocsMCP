import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL, BATCH_SIZE, BATCH_DELAY_MS } from "../shared/constants.js";
import type { DocPage } from "../shared/types.js";

function log(msg: string) {
  process.stderr.write(`[extractor] ${msg}\n`);
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function extractTitle(markdown: string, url?: string): string {
  // Try # heading, then ## heading
  const h1 = markdown.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();

  const h2 = markdown.match(/^##\s+(.+)$/m);
  if (h2) return h2[1].trim();

  // Try bold text at start
  const bold = markdown.match(/^\*\*(.+?)\*\*/m);
  if (bold) return bold[1].trim();

  // Fallback: derive from URL
  if (url) {
    const slug = url.split("/").filter(Boolean).pop() || "";
    return slug
      .replace(/\.html?$/, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return "Untitled";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripHtmlBoilerplate(html: string): string {
  // Remove script, style, nav, footer, header tags and content
  let cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, "");
  cleaned = cleaned.replace(/<nav[\s\S]*?<\/nav>/gi, "");
  cleaned = cleaned.replace(/<footer[\s\S]*?<\/footer>/gi, "");
  cleaned = cleaned.replace(/<header[\s\S]*?<\/header>/gi, "");

  // Try to extract main/article content
  const mainMatch = cleaned.match(/<main[\s\S]*?<\/main>/i) ||
    cleaned.match(/<article[\s\S]*?<\/article>/i) ||
    cleaned.match(/<div[^>]*role="main"[\s\S]*?<\/div>/i);

  if (mainMatch) {
    cleaned = mainMatch[0];
  }

  // Truncate if too long
  if (cleaned.length > 100_000) {
    cleaned = cleaned.slice(0, 100_000);
  }

  return cleaned;
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; frc-docs-mcp/1.0; documentation indexer)",
      },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export async function extractContent(
  urls: string[],
  library: string
): Promise<DocPage[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }

  const ai = new GoogleGenAI({ apiKey });
  const pages: DocPage[] = [];
  const totalBatches = Math.ceil(urls.length / BATCH_SIZE);

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} URLs)`);

    const results = await Promise.allSettled(
      batch.map(async (url) => {
        try {
          // Fetch the HTML ourselves
          const html = await fetchPage(url);
          if (!html) {
            log(`  Failed to fetch ${url}`);
            return null;
          }

          const stripped = stripHtmlBoilerplate(html);
          if (stripped.length < 100) {
            log(`  Skipping thin page: ${url}`);
            return null;
          }

          const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: `Convert this HTML documentation page to clean markdown.
Preserve: code blocks with language tags, headers, tables, lists, links.
For images: keep the original src URL as a markdown image.
Remove: any remaining navigation, breadcrumbs, or footer content.
Do NOT wrap the output in a code fence.

HTML:
${stripped}`,
            config: {
              thinkingConfig: { thinkingBudget: 0 },
            },
          });

          const content = response.text?.trim() || "";
          if (!content) {
            log(`  Empty response for ${url}`);
            return null;
          }

          const id = url
            .replace(/https?:\/\//, "")
            .replace(/[^a-zA-Z0-9]/g, "_")
            .replace(/_+/g, "_")
            .replace(/^_|_$/g, "");

          const page: DocPage = {
            id,
            title: extractTitle(content, url),
            library,
            url,
            content,
            tokens: estimateTokens(content),
          };

          log(`  Extracted: ${page.title} (${page.tokens} tokens)`);
          return page;
        } catch (err) {
          log(`  Error extracting ${url}: ${err}`);
          return null;
        }
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        pages.push(result.value);
      }
    }

    // Rate limiting delay between batches
    if (i + BATCH_SIZE < urls.length) {
      log(`  Waiting ${BATCH_DELAY_MS}ms before next batch...`);
      await sleep(BATCH_DELAY_MS);
    }
  }

  log(`Extracted ${pages.length}/${urls.length} pages for ${library}`);
  return pages;
}
