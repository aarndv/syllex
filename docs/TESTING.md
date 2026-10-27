# Testing Strategy

## Test layers

### TypeScript unit tests

Cover pure frontend logic such as:

- Library grouping and sorting
- Viewer state reducers
- Flashcard CSV validation
- Import preview summaries
- Error mapping

No frontend unit-test runner is currently configured. Until one is added, `npm run build` provides TypeScript and production-bundle verification but does not replace behavioral viewer tests.

### Rust unit and integration tests

Cover native behavior such as:

- Path containment and canonicalization
- Recursive scanning
- Supported-file detection
- Cache key generation
- LibreOffice command construction
- Conversion result validation
- Database migrations

### End-to-end tests

Cover critical workflows:

- First launch and vault selection
- Opening and navigating a PDF
- Restoring reading progress
- Importing valid and invalid flashcard CSV files
- Missing LibreOffice behavior
- Cached presentation reopening

### Manual platform tests

Run on Fedora KDE and Windows 11 for:

- Native dialogs
- WebKitGTK versus WebView2 rendering
- File watching
- Keyboard shortcuts
- System file opening
- LibreOffice detection and conversion
- Installer behavior
- Rapid PDF page changes and zoom changes while rendering
- Fast bidirectional scrolling through a long PDF in continuous mode
- Confirm PDF.js's viewer buffer releases distant page views without leaving partial canvases
- Complex tables, non-embedded standard fonts, and CMap-encoded text
- The generated PDF from a representative PPT/PPTX in both Syllex and an external viewer
- Viewer sidebar in both themes: compact file icons and names, folder rows without selection tint, and accessible ellipsis actions
- Collapse each ancestor of the open PDF and confirm the Current file link remains visible; selecting another file should reveal its tree path
- Issue #10: in both single-page and continuous modes, drag across wrapped text and non-text regions, then switch every reading filter and verify that highlights remain legible and correctly positioned after zoom and navigation
- Issue #10: dock page previews on each side, change width and thumbnail scale, close and reopen the document, and verify that one tape per highlight remains and each tape focuses the corresponding region
- Issue #10: verify compact previews have no blank row spacing, use `p1`, `p2`, … labels at the upper corner, keep tapes outside the page edge on either dock, and follow every document filter without recoloring the tape
- Issue #10: after selecting a thumbnail, navigate with Left and Right and confirm only the new current page has the translucent green overlay and frame; its label and highlight tapes remain legible under every filter, and keyboard focus follows the new thumbnail when navigation started from the preview strip
- Issue #10: choose each highlight color from the visible swatches, draw on text and non-text areas, reopen the document, and confirm its color and tape persist; use H, Escape, Done, and the six-second Undo action
- Issue #10: add more than ten highlights to one page, verify the later tapes layer behind the first column without expanding the row, and use keyboard focus to reach every tape
- Issue #10: rename a highlighted module or containing folder and verify that its highlights follow the renamed path; repeat on Fedora/WebKitGTK and Windows 11/WebView2

The viewer sidebar change is React/CSS only and uses the same behavior on Fedora/WebKitGTK and Windows/WebView2. Validate menu positioning, keyboard focus, and the sticky Current file link on both targets during the PDF smoke test.

Issue #10 adds a bundled SQLite dependency and platform application-data database. Rust migration/path tests cover the native boundary; visual highlighting, thumbnail rendering, focus navigation, and filter contrast still need manual validation in both webviews.

## Required fixtures

Create synthetic, legally distributable fixtures containing:

- Small and large PDFs
- A password-protected or unreadable PDF
- PPTX with ordinary slides
- Filenames with spaces and Unicode
- Nested directories
- Symlink/path-escape scenarios
- Valid, invalid, duplicate, and multiline CSV records

Never commit real student modules or personal flashcard data as fixtures.

## Platform matrix

| Check | Fedora | Windows 11 |
| --- | --- | --- |
| Unit tests | Required locally | Required in CI |
| Native build | Required locally | Required in CI |
| PDF smoke test | Required | Required per milestone |
| LibreOffice conversion | Required | Required per conversion milestone |
| Installer smoke test | Before release | Before release |

Development checks run locally on Fedora. CI must compile and test the Windows target before merging. Platform-sensitive milestones still require periodic manual testing of packaged builds on the Windows 11 PC.

## Performance checks

Measure rather than promise fixed targets before representative hardware and documents are selected. Track:

- Cold and warm startup time
- Time to show the initial library
- Scan time for large vaults
- Time to first PDF page
- Memory while scrolling a long PDF
- Cached and uncached presentation-open time

For continuous PDF scrolling, memory should be bounded by pages near the viewport rather than the total number of pages already visited. Test at multiple zoom levels and display scale factors on Fedora/WebKitGTK and Windows 11/WebView2.

Vault indexing must remain read-only and should avoid redundant per-entry filesystem metadata probes. Search validation should cover repeated, cancelled, and rapid query changes: only the latest query may update the interface, and extracted PDF text must remain bounded by the in-memory cache. These behaviors use browser and Rust standard APIs, so they have no platform-specific dependency; verify them on Fedora/WebKitGTK and Windows 11/WebView2 as part of the existing search and large-vault smoke tests.
