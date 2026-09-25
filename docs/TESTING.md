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
