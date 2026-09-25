# PDF Viewer Rendering Bug Resolution

## Status

The custom React canvas renderer was retired on 2026-09-25 after multiple lifecycle and font-loading changes failed to resolve the reported files. Syllex now delegates page rendering and virtualization to PDF.js's maintained viewer components. Visual validation with the originally reported "Kotlin vs Java" presentation is still required because that private fixture is not stored in this repository.

The reported symptom was displaced, overlapping, or cross-column text in presentation slides and complex PDFs, especially after fast navigation, zoom changes, or continuous scrolling.

## Findings and resolutions

| Area | Finding | Resolution |
| --- | --- | --- |
| Canvas lifecycle | A render could outlive the React effect that started it. Reusing a visible canvas exposed partial or interleaved drawing. | Removed the custom `page.render()` effects. PDF.js `PDFViewer`/`PDFSinglePageViewer` now own the render queue, cancellation, page views, and canvas lifecycle. |
| Continuous scrolling | Custom intersection observers alternated between retaining too many canvases and cancelling active work during fast scrolling. | PDF.js's visibility-aware rendering queue and bounded `PDFPageViewBuffer` now prioritize and retain pages using the upstream viewer implementation. |
| Document changes | PDF loading tasks and worker resources remained alive after closing or switching documents. | The owning loading task is destroyed during effect cleanup, and stale document/search state is cleared before the next load. |
| Page resources and font metrics | Manual operator-list and font timing changes did not resolve all complex pages. | The maintained viewer coordinates page resources and generated font faces. Arbitrary host-font substitution remains disabled with `useSystemFonts: false`; bundled standard fonts, CMaps, ICC profiles, WebAssembly assets, and the worker remain fully offline. |
| Presentation conversion | Corrected LibreOffice settings did not affect an already cached PDF, so a bad pre-fix conversion could be reused indefinitely. | Cache filenames now include conversion format version `2`. Existing unversioned previews are ignored and regenerated without touching the source presentation. |
| Concurrent conversion | Preview and search requests for the same uncached presentation could share and remove the same temporary directory. | Every conversion uses a unique output directory and LibreOffice profile. The generated file is validated as a PDF and atomically published to the cache. |
| Cross-platform profile paths | Hand-built `file://` strings were unreliable for Windows drive letters, spaces, and non-ASCII path segments. | Tauri's URL implementation now produces the LibreOffice profile file URL. Subprocess arguments remain separate and never pass through a shell. |

## Implementation locations

- [`src/components/PdfViewer.tsx`](../src/components/PdfViewer.tsx) owns the toolbar, loading, search navigation, progress, and viewer state.
- [`src/components/PdfJsViewer.tsx`](../src/components/PdfJsViewer.tsx) is a thin React adapter around PDF.js's maintained single-page and continuous viewers.
- [`src/utils/pdfInit.ts`](../src/utils/pdfInit.ts) owns the bundled worker/resource URLs and deterministic PDF.js font settings.
- [`src-tauri/src/ppt_converter.rs`](../src-tauri/src/ppt_converter.rs) owns source-path validation, versioned cache entries, isolated LibreOffice execution, and output validation.

All generated previews remain in the application cache. These changes do not write to, rename, move, or delete a course module.

## Presentation conversion limitations

If the generated PDF is already distorted in an external viewer, the defect is upstream of PDF.js. Common causes are fonts unavailable to LibreOffice and PowerPoint layouts that depend on animations, transitions, or Microsoft-specific rendering behavior. Syllex does not modify the presentation to compensate, because source modules are immutable and animation reproduction is outside the MVP.

Installing metric-compatible fonts can improve future LibreOffice conversions on Fedora. Because installed-font changes are external to Syllex and cannot be fingerprinted reliably, remove the affected disposable cached preview before retesting after a font installation. Do not alter the original presentation.

## Manual regression procedure

1. Open the affected PDF or presentation in single-page mode. Change pages and zoom repeatedly while a render is in progress; no partial previous page should become visible.
2. Switch to continuous mode in a long document and scroll rapidly in both directions. PDF.js may prioritize visible pages and discard distant canvases, but a completed visible page must not remain partial.
3. Observe process memory while traversing a long document. It may fluctuate with page size and zoom, but it must not grow solely because every previously visited canvas remains mounted.
4. For a presentation, open the generated cache PDF in Okular, Evince, or a browser. If it is correct there but wrong in Syllex, record the OS, webview, page number, zoom, and whether the problem occurs in single or continuous mode.
5. Repeat the smoke test on Fedora/WebKitGTK and Windows 11/WebView2. LibreOffice conversion itself must also be checked on both platforms because installed fonts differ.

Linux previews are under the platform cache directory, typically `~/.cache/com.syllex.app/ppt_pdf_cache/`. Windows previews are under the application cache directory resolved by Tauri; the exact base path can vary with Windows and WebView packaging.

## Automated coverage and remaining validation

Rust tests verify cache-version naming, PDF signature rejection, URL-safe isolated profiles, preservation of paths containing spaces, and selection of `pdf:impress_pdf_Export`. The TypeScript production build verifies the PDF.js options and viewer code against the installed library types.

There is not yet a configured frontend test runner or a redistributable complex-PDF/PPTX fixture, so canvas memory behavior and the original slide remain manual checks. Add only synthetic or legally redistributable fixtures if automated visual regression coverage is introduced.
