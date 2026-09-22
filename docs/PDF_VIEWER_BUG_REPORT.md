# PDF Viewer Bug Report & Investigation Handoff

## Summary of Issue

- **Symptoms**: In the PDF viewer (specifically noticeable on presentation slides and multi-column tables, such as the "Kotlin vs Java" slide), text elements, column items, or bullet points appear displaced, scattered, overlapping, or placed in adjacent columns.
- **Affected Scenarios**:
  - Continuous scroll mode during fast scrolling or page mount/unmount cycles.
  - Multi-column tables and presentations converted from `.ppt` / `.pptx` via LibreOffice.
  - Document pages with non-embedded standard fonts or complex CMap encodings.

---

## Technical Investigations & Root Cause Analysis

### 1. Canvas Lifecycle & Concurrency in React
- **Problem**: When changing pages or zooming, the previous `page.render()` task continued executing asynchronously on the same canvas 2D context while `pdfDoc.getPage()` was resolving for the new page. Calling `renderTask.cancel()` does not halt synchronous canvas operations immediately. Un-awaited cancellation caused interleaved 2D transformation matrices (`ctx.save()`, `ctx.transform()`, `ctx.scale()`, `ctx.clip()`), distorting coordinate spaces and causing text/images to bleed across pages or appear rotated/displaced.
- **Problem**: In continuous scroll mode, mounting all pages simultaneously (e.g. 50–200 pages) caused severe VRAM/RAM spikes (2–5 GB) and flooded the worker thread, causing desktop freezes/crashes.
- **Problem**: When fast-scrolling, in-progress render passes were interrupted midway, leaving visible canvases in a "semi-loaded" state with partial text. Furthermore, calling `page.cleanup()` on unmount while the worker was active cleared shared font dictionaries (`commonObjs`), corrupting subsequent glyph evaluations.

### 2. PDF.js Font Engine & Worker Resolution
- **Problem**: `pdfjsLib.GlobalWorkerOptions.workerSrc` was originally pointing to an external CDN (`cdnjs.cloudflare.com`), causing the worker to fail offline and fallback to synchronous fake-worker execution on the main UI thread.
- **Problem**: Relative paths for font definitions (`./standard_fonts/`, `./cmaps/`) were resolving relative to the worker script's subfolder (`/assets/standard_fonts/...`), returning 404s and forcing fallback to estimated font bounding boxes.
- **Problem**: By default (`disableFontFace: false`), PDF.js registers fonts asynchronously via DOM `@font-face` / `document.fonts.add()`. If `ctx.fillText()` draws before the browser's native font table finishes parsing, canvas fallback fonts with mismatched character widths are used, resulting in unpredictable horizontal offsets.

### 3. LibreOffice Presentation Conversion Pipeline
- **Problem**: PowerPoint `.pptx` slides with tables, shape animations (e.g., items set to "appear on click"), or Microsoft-specific fonts (`Calibri`, `Aptos`, `Segoe UI`) can experience layout distortions when converted headlessly by LibreOffice on Linux if metric-compatible fonts or presentation-specific export filters are not used.

---

## What Has Been Attempted & Implemented

### Frontend & Rendering Pipeline
1. **Centralized Offline PDF Initialization ([`src/utils/pdfInit.ts`](file:///home/aaron/home/personal/repo/syllex/src/utils/pdfInit.ts))**:
   - Bundled `pdf.worker.min.mjs`, `standard_fonts/`, `cmaps/`, `iccs/`, and `wasm/` locally in [`public/`](file:///home/aaron/home/personal/repo/syllex/public).
   - Configured absolute origin URLs (`origin + "/standard_fonts/"`, `origin + "/cmaps/"`) so the Web Worker resolves font metrics reliably without 404 fallbacks.
2. **Keyed Canvas DOM Isolation ([`src/components/PdfViewer.tsx`](file:///home/aaron/home/personal/repo/syllex/src/components/PdfViewer.tsx))**:
   - Single Page mode uses keyed canvas components (`key={`single-page-${currentPage}`}`) to guarantee physical DOM separation across page transitions.
   - Render tasks are explicitly cancelled and awaited (`await renderTask.promise.catch(...)`) prior to starting any new render pass.
   - Context transforms are explicitly reset (`context.setTransform(1, 0, 0, 1, 0, 0); context.clearRect(...)`).
   - Integrated `window.devicePixelRatio` for HiDPI sharpness on Linux and Windows.
3. **Continuous Scroll Virtualization & Atomic Double-Buffering ([`src/components/PdfViewer.tsx`](file:///home/aaron/home/personal/repo/syllex/src/components/PdfViewer.tsx))**:
   - Implemented `IntersectionObserver` lazy rendering with an `800px` viewport margin buffer to eliminate memory spikes and app lockups.
   - Implemented **off-DOM atomic double buffering**: `page.render()` draws completely to an off-screen canvas buffer (`document.createElement('canvas')`). Only upon 100% full completion without cancellation is the canvas swapped into the DOM (`container.replaceChildren(offscreenCanvas)`), completely preventing visible semi-loaded states.
   - Completed pages are retained in memory for instant 60 FPS scrolling without re-render churn.
   - Removed mid-render `activePage.cleanup()` calls on unmount to prevent destroying worker font tables.

### Backend Pipeline
1. **LibreOffice Impress Export Filter ([`src-tauri/src/ppt_converter.rs`](file:///home/aaron/home/personal/repo/syllex/src-tauri/src/ppt_converter.rs))**:
   - Updated LibreOffice conversion command to use explicit `pdf:impress_pdf_Export`.
   - Added isolated temporary profile directories (`-env:UserInstallation=file://...`), `--norestore`, and `--nofirststartwizard` to avoid GUI collisions and recovery locks.

---

## Remaining Investigation & Handoff Checklist for Next Developer

If text displacement is still present on specific slides (such as the "Kotlin vs Java" slide):

1. **Verify if the Distortion is in the Generated PDF File Itself**:
   - Check the converted PDF file stored in the app cache directory (`~/.cache/com.syllex.app/ppt_pdf_cache/<hash>.pdf` on Linux or `%LOCALAPPDATA%\com.syllex.app\ppt_pdf_cache\` on Windows).
   - Open that exact PDF in an external native viewer (e.g. Evince, Okular, or Chrome).
   - **If the text is already displaced in Evince/Okular**: The issue originates in LibreOffice's PPTX-to-PDF conversion stage, not PDF.js.
     - *Cause A: Missing Microsoft Fonts on Linux*: Install `google-crosextra-carlito-fonts` (Calibri metric compatible) and `liberation-fonts` on the OS.
     - *Cause B: PPTX Slide Animations*: If the slide had "Appear on click" animations on items 2–6, LibreOffice exports all animated states into one static frame. Inspect whether the original `.pptx` uses overlapping animated text boxes.
   - **If the text is clean in Evince/Okular but displaced in Syllex**: The issue is isolated to PDF.js canvas font glyph rendering.
     - Test PDF.js SVG backend (`page.getOperatorList()` + `SVGGraphics`) vs 2D Canvas backend.
     - Test font rendering flags (`disableFontFace: true` vs `disableFontFace: false` with custom font loader).
