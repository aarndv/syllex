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

Issue #9 date-only calendar calculations have focused Node built-in tests. Run `TZ=America/Los_Angeles node --test tests/academicDates.test.mjs` and `TZ=Asia/Manila node --test tests/academicDates.test.mjs` to cover both sides of UTC. The configured trimester end date is inclusive; progress reaches 100% at the next local midnight. This does not provide the broader frontend test setup tracked in issue #7.

Issue #11 tree navigation has focused Node built-in tests: `node --test tests/treeNavigation.test.mjs`. Tree semantics, focus behavior, and row actions still require manual checks in both desktop webviews.

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
- Issue #8: on the bookshelf in both themes, Tab to a book, open it with Enter and Space, then Tab to its visible Rename and Remove actions; confirm their focus rings and screen reader names include the module name, format, and reading state.
- Issue #11: in the full and compact Explorer trees, Tab into one focused row and use Up, Down, Home, End, Left, Right, Enter, and Space across nested and empty folders and files. Confirm collapsed descendants are skipped, focus and selection are distinct, and Shift+F10 or the context-menu key opens the focused row's actions; Escape restores tree focus. Check screen reader tree, group, expanded, and selected announcements.
- Issue #12: at 800×600 with the reader drawer open and closed, confirm the title, page navigation, view mode toggle, and Reader Tools button stay visible. Open Reader Tools by pointer and keyboard, reach Pages, Highlight, Find, Filter, Fit Width, and Zoom, check focus and pressed states in both themes, then resize narrower and wider without losing canvas access or clipping controls. Confirm search remains reachable below the toolbar.
- Collapse each ancestor of the open PDF and confirm the Current file link remains visible; selecting another file should reveal its tree path
- Issue #10: in both single-page and continuous modes, drag across wrapped text and non-text regions, then switch every reading filter and verify that highlights remain legible and correctly positioned after zoom and navigation
- Issue #10: drag across an image immediately beside selectable text, including near the edge of a text span, and confirm it creates a free-area box without snapping to text; start directly on letters to confirm wrapped text selection still works on Fedora/WebKitGTK and Windows 11/WebView2
- Issue #10: dock page previews on each side, change width and thumbnail scale, close and reopen the document, and verify that one tape per highlight remains and each tape focuses the corresponding region
- Issue #10: verify compact previews have no blank row spacing, use `p1`, `p2`, … labels at the upper corner, keep tapes outside the page edge on either dock, and follow every document filter without recoloring the tape
- Check that the sans-serif page-preview numbers remain legible over thumbnails in both themes and on both WebKitGTK and WebView2.
- Check the supplied horizontal Syllex wordmark on the landing screen in both themes and in the dark header; confirm there is no light panel or duplicate header title. Check the square native app icons on Fedora and Windows.
- Issue #13: in single-page mode, use a mouse wheel and trackpad over both the Explorer file list and page-preview strip (including at their ends) and confirm no page flip; wheel over the document and confirm pages still flip. Repeat with previews docked on either side, in continuous mode, and in both webviews. Check Ctrl/Cmd+wheel zoom over the document and explicit page navigation.
- Issue #10: after selecting a thumbnail, navigate with Left and Right and confirm only the new current page has the subdued green overlay and frame; its label and highlight tapes remain legible under every filter, and keyboard focus follows the new thumbnail when navigation started from the preview strip
- Issue #10: choose each highlight color from the visible swatches, draw on text and non-text areas, reopen the document, and confirm its color and tape persist; use H, Escape, Done, and the six-second Undo action
- Issue #10: choose Erase beside the color swatches, click a highlighted region to remove only that highlight, and verify its tape disappears and Undo restores both the region and tape; click unhighlighted page space to confirm nothing is removed, then choose a color and draw again
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
