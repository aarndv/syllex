import { createElement } from "react";
import type { Components } from "react-markdown";
import { safeMarkdownLink } from "./markdownSafety.ts";

export const markdownComponents: Components = {
  a: ({ href, children }) => {
    const url = safeMarkdownLink(href);
    return url
      ? createElement("a", { href: url, target: url.startsWith("#") ? undefined : "_blank", rel: "noopener noreferrer" }, children)
      : createElement("span", null, children);
  },
  img: ({ alt }) => createElement("span", { className: "markdown-image-placeholder" }, `[Image: ${alt || "embedded image blocked"}]`),
};
