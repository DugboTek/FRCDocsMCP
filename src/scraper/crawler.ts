import { Library, BASE_URLS } from "../shared/constants.js";

function log(msg: string) {
  process.stderr.write(`[crawler] ${msg}\n`);
}

async function discoverSphinxUrls(baseUrl: string): Promise<string[]> {
  const searchIndexUrl = `${baseUrl}/searchindex.js`;
  log(`Fetching Sphinx search index: ${searchIndexUrl}`);

  const response = await fetch(searchIndexUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${searchIndexUrl}: ${response.status}`);
  }

  let text = await response.text();

  // searchindex.js wraps the JSON in: Search.setIndex({...})
  const match = text.match(/Search\.setIndex\((\{[\s\S]*\})\)/);
  if (!match) {
    throw new Error("Could not parse Sphinx searchindex.js format");
  }

  const index = JSON.parse(match[1]);
  const docnames: string[] = index.docnames || index.filenames || [];

  if (docnames.length === 0) {
    throw new Error("No docnames found in searchindex.js");
  }

  const urls = docnames.map((name: string) => {
    // Remove .html extension if present, then add it back
    const cleanName = name.replace(/\.html$/, "");
    return `${baseUrl}/${cleanName}.html`;
  });

  log(`Discovered ${urls.length} URLs from Sphinx index`);
  return urls;
}

async function discoverSitemapUrls(baseUrl: string): Promise<string[]> {
  const sitemapUrl = `${baseUrl}/sitemap.xml`;
  log(`Trying sitemap: ${sitemapUrl}`);

  try {
    const response = await fetch(sitemapUrl);
    if (response.ok) {
      const text = await response.text();

      // Check if this is a sitemap index (contains <sitemap> elements)
      const sitemapRefs: string[] = [];
      const sitemapRegex = /<loc>(.*?sitemap.*?\.xml)<\/loc>/g;
      let sitemapMatch;
      while ((sitemapMatch = sitemapRegex.exec(text)) !== null) {
        sitemapRefs.push(sitemapMatch[1]);
      }

      if (sitemapRefs.length > 0) {
        // It's a sitemap index — fetch each child sitemap
        log(`Found sitemap index with ${sitemapRefs.length} sub-sitemaps`);
        const allUrls: string[] = [];
        for (const ref of sitemapRefs) {
          try {
            const subResponse = await fetch(ref);
            if (subResponse.ok) {
              const subText = await subResponse.text();
              const locRegex = /<loc>(.*?)<\/loc>/g;
              let match;
              while ((match = locRegex.exec(subText)) !== null) {
                allUrls.push(match[1]);
              }
            }
          } catch {
            log(`  Failed to fetch sub-sitemap: ${ref}`);
          }
        }
        log(`Discovered ${allUrls.length} URLs from sitemap index`);
        return allUrls;
      }

      // Regular sitemap — extract URLs directly
      const urls: string[] = [];
      const locRegex = /<loc>(.*?)<\/loc>/g;
      let match;
      while ((match = locRegex.exec(text)) !== null) {
        urls.push(match[1]);
      }
      if (urls.length > 0) {
        log(`Discovered ${urls.length} URLs from sitemap`);
        return urls;
      }
    }
  } catch {
    log("Sitemap not available, falling back to recursive crawl");
  }

  // Fallback: recursive crawl
  return recursiveCrawl(baseUrl, 3);
}

async function recursiveCrawl(
  baseUrl: string,
  maxDepth: number
): Promise<string[]> {
  const visited = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [
    { url: baseUrl, depth: 0 },
  ];

  log(`Starting recursive crawl from ${baseUrl} (max depth: ${maxDepth})`);

  while (queue.length > 0) {
    const { url, depth } = queue.shift()!;

    if (visited.has(url) || depth > maxDepth) continue;
    visited.add(url);

    try {
      const response = await fetch(url);
      if (!response.ok) continue;

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) continue;

      const html = await response.text();

      // Extract same-origin links
      const hrefRegex = /href="([^"]*?)"/g;
      let match;
      while ((match = hrefRegex.exec(html)) !== null) {
        let href = match[1];

        // Skip anchors, mailto, external links, assets
        if (
          href.startsWith("#") ||
          href.startsWith("mailto:") ||
          href.startsWith("javascript:") ||
          href.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|pdf|zip)$/i)
        ) {
          continue;
        }

        // Resolve relative URLs
        if (href.startsWith("/")) {
          const base = new URL(baseUrl);
          href = `${base.origin}${href}`;
        } else if (!href.startsWith("http")) {
          href = new URL(href, url).toString();
        }

        // Only follow same-origin links
        const baseOrigin = new URL(baseUrl).origin;
        if (href.startsWith(baseOrigin) && !visited.has(href)) {
          // Remove fragment
          href = href.split("#")[0];
          if (!visited.has(href)) {
            queue.push({ url: href, depth: depth + 1 });
          }
        }
      }
    } catch {
      // Skip failed pages
    }
  }

  log(`Recursive crawl found ${visited.size} URLs`);
  return Array.from(visited);
}

export async function discoverUrls(library: Library): Promise<string[]> {
  const baseUrl = BASE_URLS[library];

  switch (library) {
    case Library.WPILib:
    case Library.CTREPhoenix6:
      return discoverSphinxUrls(baseUrl);
    case Library.AdvantageKit:
    case Library.REVRobotics:
    case Library.Limelight:
      return discoverSitemapUrls(baseUrl);
    default:
      throw new Error(`Unknown library: ${library}`);
  }
}
