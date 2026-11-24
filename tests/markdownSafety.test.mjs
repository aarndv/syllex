import assert from "node:assert/strict";
import test from "node:test";
import { safeMarkdownLink } from "../src/utils/markdownSafety.ts";
import { markdownComponents } from "../src/utils/markdownComponents.ts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

test("Markdown links reject active and local resource schemes", () => {
  assert.equal(safeMarkdownLink("javascript:alert(1)"), null);
  assert.equal(safeMarkdownLink("data:text/html,<script>1</script>"), null);
  assert.equal(safeMarkdownLink("file:///etc/passwd"), null);
  assert.equal(safeMarkdownLink("./other.md"), null);
  assert.equal(safeMarkdownLink("https://example.com/notes"), "https://example.com/notes");
  assert.equal(safeMarkdownLink("#section"), "#section");
});

test("Markdown rendering drops raw HTML and never loads embedded images", () => {
  const source = "# Heading\n\n<script>alert(1)</script>\n\n![remote](https://example.com/image.png)\n\n[bad](javascript:alert(1))\n\n| a | b |\n| - | - |\n| 1 | 2 |";
  const html = renderToStaticMarkup(createElement(ReactMarkdown, {
    remarkPlugins: [remarkGfm], skipHtml: true, components: markdownComponents, children: source,
  }));
  assert.match(html, /<h1>Heading<\/h1>/);
  assert.match(html, /<table>/);
  assert.doesNotMatch(html, /<script|<img|image\.png|javascript:/);
});
