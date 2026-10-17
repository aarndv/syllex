import { pdfjsLib, getPdfDocumentParams } from "./pdfInit";
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

// Keep recent document text available for fast repeat searches without retaining an
// unbounded number of complete PDFs in memory.
const pdfTextCache = new Map<string, PdfPageText[]>();
const MAX_CACHED_PDF_TEXT_DOCUMENTS = 24;
const PDF_SEARCH_CONCURRENCY = 3;

function getCachedPdfText(cacheKey: string): PdfPageText[] | undefined {
  const pages = pdfTextCache.get(cacheKey);
  if (!pages) return undefined;

  // Map insertion order gives us a small, dependency-free LRU cache.
  pdfTextCache.delete(cacheKey);
  pdfTextCache.set(cacheKey, pages);
  return pages;
}

function cachePdfText(cacheKey: string, pages: PdfPageText[]): void {
  pdfTextCache.delete(cacheKey);
  pdfTextCache.set(cacheKey, pages);

  while (pdfTextCache.size > MAX_CACHED_PDF_TEXT_DOCUMENTS) {
    const oldestKey = pdfTextCache.keys().next().value;
    if (!oldestKey) break;
    pdfTextCache.delete(oldestKey);
  }
}

/**
 * Extract text from all pages of a PDF document
 */
export async function extractPdfText(
  vaultRoot: string,
  relativePath: string
): Promise<PdfPageText[]> {
  const cacheKey = `${vaultRoot}:${relativePath}`;
  const cachedPages = getCachedPdfText(cacheKey);
  if (cachedPages) {
    return cachedPages;
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
  const loadingTask = pdfjsLib.getDocument(getPdfDocumentParams(uint8Array));
  try {
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

    cachePdfText(cacheKey, pages);
    return pages;
  } finally {
    try {
      await loadingTask.destroy();
    } catch {
      // Preserve the original document error if PDF.js cleanup also fails.
    }
  }
}

/**
 * Extract text directly from an already loaded PDFDocumentProxy
 */
export async function extractLoadedPdfDocText(
  doc: pdfjsLib.PDFDocumentProxy,
  cacheKey?: string
): Promise<PdfPageText[]> {
  const cachedPages = cacheKey ? getCachedPdfText(cacheKey) : undefined;
  if (cachedPages) {
    return cachedPages;
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
    cachePdfText(cacheKey, pages);
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
  maxResults: number = 30,
  signal?: AbortSignal
): Promise<MultiPdfSearchResult[]> {
  const q = query.trim().toLowerCase();
  if (!q || q.length < 2) return [];

  async function searchDocument(
    item: { node: VaultNode; parentPath: string }
  ): Promise<MultiPdfSearchResult[]> {
    try {
      const pages = await extractPdfText(vaultRoot, item.node.relative_path);
      if (signal?.aborted) return [];

      const pageGroups = new Map<number, { count: number; snippet: string }>();
      for (const match of searchInDocPages(pages, q)) {
        const existing = pageGroups.get(match.pageNum);
        if (existing) {
          existing.count++;
        } else {
          pageGroups.set(match.pageNum, { count: 1, snippet: match.snippet });
        }
      }

      return Array.from(pageGroups, ([pageNum, { count, snippet }]) => ({
        node: item.node,
        parentPath: item.parentPath,
        pageNum,
        snippet,
        matchCount: count,
      }));
    } catch {
      // A single unreadable document must not prevent results from other modules.
      return [];
    }
  }

  const results: MultiPdfSearchResult[] = [];
  for (let start = 0; start < pdfNodes.length && results.length < maxResults; start += PDF_SEARCH_CONCURRENCY) {
    if (signal?.aborted) return [];

    const batch = pdfNodes.slice(start, start + PDF_SEARCH_CONCURRENCY);
    const batchResults = await Promise.all(batch.map(searchDocument));
    for (const documentResults of batchResults) {
      results.push(...documentResults);
      if (results.length >= maxResults) break;
    }
  }

  return signal?.aborted ? [] : results.slice(0, maxResults);
}
