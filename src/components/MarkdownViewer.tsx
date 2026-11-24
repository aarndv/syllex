import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { VaultNode } from "../types/vault";
import { OpenOriginalButton } from "./OpenOriginalButton";
import { markdownComponents } from "../utils/markdownComponents";
import "./MarkdownViewer.css";

interface MarkdownModule { content: string }

export function MarkdownViewer({ node, onClose }: { node: VaultNode; onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setContent(null);
    setError(null);
    invoke<MarkdownModule>("read_markdown_module", { relativePath: node.relative_path })
      .then((result) => { if (active) setContent(result.content); })
      .catch((failure: unknown) => {
        if (active) setError(typeof failure === "string" ? failure : "Could not read this Markdown module.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [node.relative_path, revision]);

  return <div className="pdf-viewer-overlay markdown-reader">
    <header className="markdown-reader-toolbar">
      <button type="button" className="toolbar-btn" onClick={onClose}>Back to library</button>
      <strong title={node.name}>{node.name}</strong>
      <OpenOriginalButton relativePath={node.relative_path} />
    </header>
    <main className="markdown-reader-scroll">
      {loading && <p role="status">Loading Markdown module…</p>}
      {error && <div className="markdown-reader-state" role="alert">
        <p>{error}</p>
        <button type="button" className="toolbar-btn" onClick={() => setRevision((value) => value + 1)}>Retry</button>
        <OpenOriginalButton relativePath={node.relative_path} />
      </div>}
      {!loading && !error && content !== null && (
        content.trim() ? <article className="markdown-reader-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={markdownComponents}>{content}</ReactMarkdown>
        </article> : <div className="markdown-reader-state">
          <p>This Markdown module is empty.</p>
          <OpenOriginalButton relativePath={node.relative_path} />
        </div>
      )}
    </main>
  </div>;
}
