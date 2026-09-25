# Archived PDF Viewer Bug Record

## Lifecycle status

- **Overall record:** Superseded; this is not an active bug backlog.
- **Historical implementation:** Custom React components calling `PDFPageProxy.render()` directly, through commit `9666aaf`.
- **Replacement:** PDF.js `PDFViewer` and `PDFSinglePageViewer`, introduced in commit `a2dfd93` and recorded by [D-014](DECISIONS.md#d-014--use-pdfjs-maintained-viewer-components).
- **Original symptom under the replacement:** Pending manual validation because the private "Kotlin vs Java" fixture is not stored in this repository.

The custom React canvas renderer was retired on 2026-09-25 after multiple lifecycle and font-loading changes failed to resolve the reported files. Syllex now delegates page rendering and virtualization to PDF.js's maintained viewer components.

Do not continue the custom-renderer investigation described here or recreate its canvas scheduler. If the same symptom occurs on commit `a2dfd93` or later, record it as a new upstream-viewer bug with fresh reproduction evidence and link back to this archived record.

Status meanings used below:

- **Superseded:** The affected implementation was removed; the old bug is no longer actionable.
- **Resolved:** The fix remains present and relevant in the current implementation.
- **Pending validation:** The architecture changed, but the original private fixture has not been retested.
- **External limitation:** The behavior originates outside Syllex and cannot be fixed safely by changing source modules.

The reported symptom was displaced, overlapping, or cross-column text in presentation slides and complex PDFs, especially after fast navigation, zoom changes, or continuous scrolling.

## Historical findings and disposition

| Area | Status | Finding | Current disposition |
| --- | --- | --- | --- |
| Custom canvas lifecycle | **Superseded** | A render could outlive the React effect that started it. Reusing a visible canvas exposed partial or interleaved drawing. | The custom `page.render()` effects were removed. PDF.js's maintained viewers own the render queue, cancellation, page views, and canvas lifecycle. |
| Custom continuous scrolling | **Superseded** | Intersection observers alternated between retaining too many canvases and cancelling active work during fast scrolling. | The custom observer and canvas-retention code was removed. PDF.js's visibility-aware rendering queue and bounded `PDFPageViewBuffer` now own this behavior. |
| Document teardown | **Resolved** | PDF loading tasks and worker resources remained alive after closing or switching documents. | The owning loading task is destroyed during effect cleanup, and stale document/search state is cleared before the next load. |
| Manual page-resource and font timing | **Superseded; original symptom pending validation** | Manual operator-list waits, font timing, and path-only glyph rendering did not resolve all complex pages. | Those workarounds were removed. The maintained viewer coordinates page resources and generated font faces. Host-font substitution remains disabled; bundled resources remain offline. |
| Presentation cache invalidation | **Resolved** | Corrected LibreOffice settings did not affect an already cached PDF, so a bad pre-fix conversion could be reused indefinitely. | Cache filenames include conversion format version `2`. Existing unversioned previews are ignored and regenerated without touching the source presentation. |
| Concurrent presentation conversion | **Resolved** | Preview and search requests for the same uncached presentation could share and remove the same temporary directory. | Every conversion uses a unique output directory and LibreOffice profile. The generated file is validated and atomically published to cache. |
| Cross-platform LibreOffice profile paths | **Resolved** | Hand-built `file://` strings were unreliable for Windows drive letters, spaces, and non-ASCII path segments. | Tauri's URL implementation produces the profile URL. Arguments remain separate and never pass through a shell. |
| Missing fonts, animations, or LibreOffice layout differences in the generated PDF | **External limitation** | A converted PDF can already contain distorted layout before PDF.js opens it. | Compare the cached PDF in an external viewer. Do not modify the original presentation; address the LibreOffice/font environment or document authoring instead. |

## Implementation locations

- [`src/components/PdfViewer.tsx`](../src/components/PdfViewer.tsx) owns the toolbar, loading, search navigation, progress, and viewer state.
- [`src/components/PdfJsViewer.tsx`](../src/components/PdfJsViewer.tsx) is a thin React adapter around PDF.js's maintained single-page and continuous viewers.
- [`src/utils/pdfInit.ts`](../src/utils/pdfInit.ts) owns the bundled worker/resource URLs and deterministic PDF.js font settings.
- [`src-tauri/src/ppt_converter.rs`](../src-tauri/src/ppt_converter.rs) owns source-path validation, versioned cache entries, isolated LibreOffice execution, and output validation.

All generated previews remain in the application cache. These changes do not write to, rename, move, or delete a course module.

## Presentation conversion limitations

If the generated PDF is already distorted in an external viewer, the defect is upstream of PDF.js. Common causes are fonts unavailable to LibreOffice and PowerPoint layouts that depend on animations, transitions, or Microsoft-specific rendering behavior. Syllex does not modify the presentation to compensate, because source modules are immutable and animation reproduction is outside the MVP.

Installing metric-compatible fonts can improve future LibreOffice conversions on Fedora. Because installed-font changes are external to Syllex and cannot be fingerprinted reliably, remove the affected disposable cached preview before retesting after a font installation. Do not alter the original presentation.

## Post-replacement validation procedure

1. Open the affected PDF or presentation in single-page mode. Change pages and zoom repeatedly while a render is in progress; no partial previous page should become visible.
2. Switch to continuous mode in a long document and scroll rapidly in both directions. PDF.js may prioritize visible pages and discard distant canvases, but a completed visible page must not remain partial.
3. Observe process memory while traversing a long document. It may fluctuate with page size and zoom, but it must not grow solely because every previously visited canvas remains mounted.
4. For a presentation, open the generated cache PDF in Okular, Evince, or a browser. If it is correct there but wrong in Syllex, record the OS, webview, page number, zoom, and whether the problem occurs in single or continuous mode.
5. Repeat the smoke test on Fedora/WebKitGTK and Windows 11/WebView2. LibreOffice conversion itself must also be checked on both platforms because installed fonts differ.

Linux previews are under the platform cache directory, typically `~/.cache/com.syllex.app/ppt_pdf_cache/`. Windows previews are under the application cache directory resolved by Tauri; the exact base path can vary with Windows and WebView packaging.

## Automated coverage and remaining validation

Rust tests verify cache-version naming, PDF signature rejection, URL-safe isolated profiles, preservation of paths containing spaces, and selection of `pdf:impress_pdf_Export`. The TypeScript production build verifies the PDF.js options and viewer code against the installed library types.

There is not yet a configured frontend test runner or a redistributable complex-PDF/PPTX fixture, so viewer memory behavior and the original slide remain manual checks. This pending validation does not reactivate the superseded custom-renderer bugs. Add only synthetic or legally redistributable fixtures if automated visual regression coverage is introduced.
