/**
 * Converts RST (reStructuredText) content to Markdown.
 * Handles the hybrid RST/MyST format used by frc-docs.
 */

export function rstToMarkdown(rst: string): string {
  let lines = rst.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip include directives and :orphan:
    if (line.match(/^\.\.\s+include::/) || line.match(/^:orphan:/)) {
      i++;
      continue;
    }

    // Convert RST title underlines to # headers
    // A title is a line followed by a line of the same length with =, -, ~, ^, "
    if (i + 1 < lines.length && lines[i + 1]) {
      const nextLine = lines[i + 1];
      const underlineMatch = nextLine.match(/^([=\-~^"]{3,})$/);
      if (
        underlineMatch &&
        line.trim().length > 0 &&
        !line.startsWith(" ") &&
        !line.startsWith(".")
      ) {
        const char = underlineMatch[1][0];
        const level = char === "=" ? 1 : char === "-" ? 2 : char === "~" ? 3 : 4;
        out.push(`${"#".repeat(level)} ${line.trim()}`);
        i += 2;
        continue;
      }
    }

    // Also handle overline + title + underline pattern
    if (
      i + 2 < lines.length &&
      line.match(/^([=\-~^"]{3,})$/) &&
      lines[i + 2]?.match(/^([=\-~^"]{3,})$/) &&
      lines[i + 1]?.trim().length > 0
    ) {
      out.push(`# ${lines[i + 1].trim()}`);
      i += 3;
      continue;
    }

    // Convert admonition directives: .. note::, .. warning::, .. important::, .. tip::
    const admonitionMatch = line.match(
      /^\.\.\s+(note|warning|important|tip|caution|danger|todo|seealso)::\s*(.*)/i
    );
    if (admonitionMatch) {
      const type = admonitionMatch[1].charAt(0).toUpperCase() + admonitionMatch[1].slice(1);
      const inlineContent = admonitionMatch[2].trim();
      const blockLines: string[] = [];
      if (inlineContent) blockLines.push(inlineContent);

      i++;
      // Collect indented content
      while (i < lines.length && (lines[i].match(/^\s{3,}/) || lines[i].trim() === "")) {
        if (lines[i].trim() === "" && blockLines.length > 0) {
          blockLines.push("");
        } else if (lines[i].trim()) {
          blockLines.push(lines[i].replace(/^\s{3,}/, ""));
        }
        i++;
      }

      out.push("");
      out.push(`> **${type}:** ${blockLines.join(" ").trim()}`);
      out.push("");
      continue;
    }

    // Convert .. image:: directives
    const imageMatch = line.match(/^\.\.\s+image::\s+(.*)/);
    if (imageMatch) {
      const src = imageMatch[1].trim();
      let alt = "";
      i++;
      // Check for :alt: option
      while (i < lines.length && lines[i].match(/^\s{3,}:/)) {
        const altMatch = lines[i].match(/:alt:\s*(.*)/);
        if (altMatch) alt = altMatch[1].trim();
        i++;
      }
      out.push(`![${alt}](${src})`);
      continue;
    }

    // Convert .. figure:: directives
    const figureMatch = line.match(/^\.\.\s+figure::\s+(.*)/);
    if (figureMatch) {
      const src = figureMatch[1].trim();
      let alt = "";
      i++;
      while (i < lines.length && (lines[i].match(/^\s{3,}/) || lines[i].trim() === "")) {
        const altMatch = lines[i].match(/:alt:\s*(.*)/);
        if (altMatch) alt = altMatch[1].trim();
        i++;
      }
      out.push(`![${alt}](${src})`);
      continue;
    }

    // Convert tab-set-code directive: just pass through the code blocks inside
    if (line.match(/^\.\.\s+tab-set-code::/)) {
      i++;
      // Skip blank lines after directive
      while (i < lines.length && lines[i].trim() === "") i++;
      // Process indented code blocks within
      while (i < lines.length && (lines[i].match(/^\s{2,}/) || lines[i].trim() === "")) {
        const trimmed = lines[i].replace(/^\s{2,}/, "");
        out.push(trimmed);
        i++;
      }
      continue;
    }

    // Convert tab-set with tab-items
    if (line.match(/^\.\.\s+tab-set::/)) {
      i++;
      while (i < lines.length && lines[i].trim() === "") i++;

      while (i < lines.length && lines[i].match(/^\s{3,}\.\.\s+tab-item::/)) {
        const tabMatch = lines[i].match(/tab-item::\s*(.*)/);
        const tabName = tabMatch ? tabMatch[1].trim() : "";
        out.push("");
        out.push(`**${tabName}:**`);
        i++;

        // Skip options like :sync:
        while (i < lines.length && lines[i].match(/^\s{6,}:/)) i++;
        while (i < lines.length && lines[i].trim() === "") i++;

        // Collect tab content
        while (
          i < lines.length &&
          (lines[i].match(/^\s{6,}/) || lines[i].trim() === "") &&
          !lines[i].match(/^\s{3,}\.\.\s+tab-item::/)
        ) {
          out.push(lines[i].replace(/^\s{6,}/, ""));
          i++;
        }

        // Skip trailing blanks between tabs
        while (i < lines.length && lines[i].trim() === "") i++;
      }
      continue;
    }

    // Convert remoteliteralinclude to a reference
    const remoteLitMatch = line.match(/^\s*\.\.\s+remoteliteralinclude::\s+(.*)/);
    if (remoteLitMatch) {
      const url = remoteLitMatch[1].trim();
      let lang = "";
      i++;
      while (i < lines.length && lines[i].match(/^\s{3,}:/)) {
        const langMatch = lines[i].match(/:language:\s*(.*)/);
        if (langMatch) lang = langMatch[1].trim();
        i++;
      }
      out.push("");
      out.push(`*See source: [${lang || "code"}](${url})*`);
      out.push("");
      continue;
    }

    // Convert code-block directives
    const codeBlockMatch = line.match(/^\.\.\s+code-block::\s*(.*)/);
    if (codeBlockMatch) {
      const lang = codeBlockMatch[1].trim();
      i++;
      // Skip options
      while (i < lines.length && lines[i].match(/^\s{3,}:/)) i++;
      while (i < lines.length && lines[i].trim() === "") i++;

      out.push(`\`\`\`${lang}`);
      while (i < lines.length && (lines[i].match(/^\s{3,}/) || lines[i].trim() === "")) {
        if (lines[i].trim() === "" && i + 1 < lines.length && !lines[i + 1]?.match(/^\s{3,}/)) {
          break;
        }
        out.push(lines[i].replace(/^\s{3,}/, ""));
        i++;
      }
      out.push("```");
      continue;
    }

    // Skip other unknown directives but keep their content
    if (line.match(/^\.\.\s+\w+::/)) {
      i++;
      // Skip options
      while (i < lines.length && lines[i].match(/^\s{3,}:/)) i++;
      continue;
    }

    // Convert RST inline markup
    let converted = line;

    // Convert :ref:`text <target>` to just text
    converted = converted.replace(/:ref:`([^<`]+)<[^>]+>`/g, "$1");
    // Convert :ref:`target` to target
    converted = converted.replace(/:ref:`([^`]+)`/g, "$1");
    // Convert :doc:`text` to text
    converted = converted.replace(/:doc:`([^`]+)`/g, "$1");
    // Convert :term:`text` to *text*
    converted = converted.replace(/:term:`([^`]+)`/g, "*$1*");
    // Convert :external:py:class:`text <target>` and similar
    converted = converted.replace(/:external:[^`]+`([^<`]+)<[^>]+>`/g, "$1");
    converted = converted.replace(/:external:[^`]+`([^`]+)`/g, "`$1`");
    // Convert other RST roles like :guilabel:`text` to **text**
    converted = converted.replace(/:guilabel:`([^`]+)`/g, "**$1**");
    converted = converted.replace(/:menuselection:`([^`]+)`/g, "**$1**");
    converted = converted.replace(/:file:`([^`]+)`/g, "`$1`");
    converted = converted.replace(/:command:`([^`]+)`/g, "`$1`");
    // Convert ``text`` to `text`
    converted = converted.replace(/``([^`]+)``/g, "`$1`");
    // Convert |reg| and other substitutions
    converted = converted.replace(/\|reg\|/g, "\u00AE");
    converted = converted.replace(/\\\s+/g, " ");

    out.push(converted);
    i++;
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
