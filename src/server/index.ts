import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadDocs, type DocsBundle } from "./loader.js";
import { searchDocs } from "./search.js";
import { readDoc } from "./read.js";

function log(msg: string) {
  process.stderr.write(`[server] ${msg}\n`);
}

export async function startServer() {
  log("Loading documentation bundle...");
  let bundle: DocsBundle;
  try {
    bundle = loadDocs();
  } catch (err) {
    log(
      `Failed to load docs.json. Run "frc-docs-mcp scrape" first to generate the documentation bundle.`
    );
    log(`Error: ${err}`);
    process.exit(1);
  }

  const server = new McpServer({
    name: "frc-docs-mcp",
    version: "1.0.0",
  });

  // search_frc_docs tool
  server.tool(
    "search_frc_docs",
    "Search FRC documentation across WPILib, CTRE Phoenix 6, REV Robotics, Limelight, and AdvantageKit. Returns matching pages with relevance scores and snippets.",
    {
      query: z.string().describe("Search query (e.g., 'PIDController', 'swerve drive', 'motor configuration')"),
      library: z
        .enum(["WPILib", "CTRE Phoenix 6", "REV Robotics", "Limelight", "AdvantageKit"])
        .optional()
        .describe("Filter results to a specific library"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Maximum number of results to return (default: 10)"),
    },
    async ({ query, library, limit }) => {
      const results = searchDocs(bundle, query, library, limit ?? 10);

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No results found for "${query}"${library ? ` in ${library}` : ""}.`,
            },
          ],
        };
      }

      const text = results
        .map(
          (r, i) =>
            `${i + 1}. **${r.title}** (${r.library})\n   Score: ${r.score.toFixed(2)} | ID: ${r.id}\n   URL: ${r.url}\n   ${r.snippet}`
        )
        .join("\n\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${results.length} result(s) for "${query}":\n\n${text}`,
          },
        ],
      };
    }
  );

  // read_documentation tool
  server.tool(
    "read_documentation",
    "Read the full content of a specific FRC documentation page by its ID. Use search_frc_docs first to find the page ID.",
    {
      id: z.string().describe("The page ID (from search results)"),
    },
    async ({ id }) => {
      const page = readDoc(bundle, id);

      if (!page) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No page found with ID "${id}". Use search_frc_docs to find valid page IDs.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `# ${page.title}\n\n**Library:** ${page.library}\n**URL:** ${page.url}\n**Tokens:** ~${page.tokens}\n\n---\n\n${page.content}`,
          },
        ],
      };
    }
  );

  log("Starting MCP server over stdio...");
  log(
    `Loaded ${bundle.metadata.totalPages} pages (${bundle.metadata.totalTokens.toLocaleString()} tokens)`
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("MCP server connected and ready.");
}
