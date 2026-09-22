import { pdfjsLib } from "./pdfInit";
import { invoke } from "@tauri-apps/api/core";
import { VaultNode } from "../types/vault";

export interface PdfPageText {
  pageNum: number;
  text: string;
}

export interface PdfSearchMatch {
  pageNum: number;
  matchIndex: number;
  snippet: string;
}

export interface MultiPdfSearchResult {
  node: VaultNode;
  parentPath: string;
  pageNum: number;
  snippet: string;
  matchCount: number;
}

// In-memory cache for extracted text of PDFs
const pdfTextCache = new Map<string, PdfPageText[]>();

/**
 * Extract text from all pages of a PDF document
 */
export async function extractPdfText(
  vaultRoot: string,
  relativePath: string
): Promise<PdfPageText[]> {
  const cacheKey = `${vaultRoot}:${relativePath}`;
  if (pdfTextCache.has(cacheKey)) {
    return pdfTextCache.get(cacheKey)!;
  }

  const isPpt =
    relativePath.toLowerCase().endsWith(".ppt") ||
    relativePath.toLowerCase().endsWith(".pptx");

  let fileBytes: number[];
  if (isPpt) {
    fileBytes = await invoke<number[]>("convert_ppt_to_pdf", {
      vaultRoot,
      relativePath,
    });
  } else {
    fileBytes = await invoke<number[]>("read_module_bytes", {
      vaultRoot,
      relativePath,
    });
  }

  const uint8Array = new Uint8Array(fileBytes);
  const loadingTask = pdfjsLib.getDocument({ data: uint8Array, cMapPacked: true });
  const doc = await loadingTask.promise;

  const pages: PdfPageText[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push({ pageNum: i, text });
  }

  pdfTextCache.set(cacheKey, pages);
  return pages;
}

/**
 * Extract text directly from an already loaded PDFDocumentProxy
 */
export async function extractLoadedPdfDocText(
  doc: pdfjsLib.PDFDocumentProxy,
  cacheKey?: string
): Promise<PdfPageText[]> {
  if (cacheKey && pdfTextCache.has(cacheKey)) {
    return pdfTextCache.get(cacheKey)!;
  }

  const pages: PdfPageText[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push({ pageNum: i, text });
  }

  if (cacheKey) {
    pdfTextCache.set(cacheKey, pages);
  }
  return pages;
}

/**
 * Generate a nice contextual snippet around a matched keyword
 */
export function createSnippet(
  fullText: string,
  matchIdx: number,
  matchLength: number,
  contextRadius: number = 45
): string {
  const start = Math.max(0, matchIdx - contextRadius);
  const end = Math.min(fullText.length, matchIdx + matchLength + contextRadius);

  let snippet = fullText.substring(start, end).replace(/\s+/g, " ");
  if (start > 0) snippet = "..." + snippet;
  if (end < fullText.length) snippet = snippet + "...";
  return snippet;
}

/**
 * Search inside a list of page texts for a single document
 */
export function searchInDocPages(
  pages: PdfPageText[],
  query: string
): PdfSearchMatch[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const matches: PdfSearchMatch[] = [];

  for (const page of pages) {
    const lowerText = page.text.toLowerCase();
    let idx = 0;
    while ((idx = lowerText.indexOf(q, idx)) !== -1) {
      const snippet = createSnippet(page.text, idx, q.length);
      matches.push({
        pageNum: page.pageNum,
        matchIndex: idx,
        snippet,
      });
      idx += q.length;
    }
  }

  return matches;
}

/**
 * Search text across multiple PDF documents in the vault
 */
export async function searchVaultPdfs(
  vaultRoot: string,
  pdfNodes: { node: VaultNode; parentPath: string }[],
  query: string,
  maxResults: number = 30
): Promise<MultiPdfSearchResult[]> {
  const q = query.trim().toLowerCase();
  if (!q || q.length < 2) return [];

  const results: MultiPdfSearchResult[] = [];

  for (const item of pdfNodes) {
    if (results.length >= maxResults) break;
    try {
      const pages = await extractPdfText(vaultRoot, item.node.relative_path);
      const matches = searchInDocPages(pages, q);

      if (matches.length > 0) {
        const pageGroups = new Map<number, { count: number; snippet: string }>();
        for (const m of matches) {
          if (!pageGroups.has(m.pageNum)) {
            pageGroups.set(m.pageNum, { count: 1, snippet: m.snippet });
          } else {
            pageGroups.get(m.pageNum)!.count++;
          }
        }

        for (const [pageNum, { count, snippet }] of pageGroups.entries()) {
          results.push({
            node: item.node,
            parentPath: item.parentPath,
            pageNum,
            snippet,
            matchCount: count,
          });
          if (results.length >= maxResults) break;
        }
      }
    } catch {
      // Ignore individual file read or parse error
    }
  }

  return results;
}
