#!/usr/bin/env node

import { Command } from "commander";
import { startServer } from "./server/index.js";

const program = new Command();

program
  .name("frc-docs-mcp")
  .description(
    "MCP server for FRC documentation (WPILib, CTRE Phoenix 6, AdvantageKit)"
  )
  .version("1.0.0");

program
  .command("scrape")
  .description(
    "Scrape and index FRC documentation (requires GEMINI_API_KEY for CTRE/AdvantageKit)"
  )
  .action(async () => {
    try {
      const { scrape } = await import("./scraper/index.js");
      await scrape();
    } catch (err) {
      process.stderr.write(`Scrape failed: ${err}\n`);
      process.exit(1);
    }
  });

program
  .command("serve", { isDefault: true })
  .description("Start the MCP server over stdio (default)")
  .action(async () => {
    try {
      await startServer();
    } catch (err) {
      process.stderr.write(`Server failed: ${err}\n`);
      process.exit(1);
    }
  });

program.parse();
