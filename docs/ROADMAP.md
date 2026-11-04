# Roadmap

Work on one milestone or focused issue at a time. The next release is for the owner's Fedora and Windows 11 devices. Checked items describe implemented work; unchecked items still require implementation and verification.

## M0 — Repository baseline

- [x] Establish product and architecture documentation
- [x] Establish agent, security, and testing rules
- [ ] Review remaining unresolved questions with the owner
- [x] Initialize Git and commit the documentation baseline

## M1 — Application scaffold

- [x] Start Tauri 2, React, TypeScript, and Vite on Fedora
- [x] Configure formatting, linting, type-checking, and basic tests
- [x] Configure Rust formatting, Clippy, and tests
- [x] Compile on a Windows CI runner

## M2 — Vault selection and safe scan

- [x] Select and persist a vault in platform app data
- [x] Discover supported modules and group first-level folders as courses
- [x] Handle missing, inaccessible, and empty vaults
- [x] Bound scans and avoid linked cycles and outside-vault traversal
- [x] Keep original modules unchanged during scans and metadata-only library actions

## M3 — PDF viewer

- [x] Open PDFs through PDF.js with lazy rendering, page navigation, zoom, and search
- [x] Remember the last page locally and handle malformed/protected PDFs

## M4 — Document viewing filters

- [x] Provide reversible Original and Fast Dark modes
- [x] Test representative document styles

## M5 — PowerPoint conversion and reader fallback

- [x] Detect LibreOffice on Fedora and Windows
- [x] Convert PPT/PPTX into the application cache and reuse valid conversions
- [x] Show conversion failure states and pass subprocess arguments without a shell
- [ ] Wire Open Original into the reader and validate the fallback on both platforms

## M6 — Portable vault study data and flashcards

Complete the `preM6 issues` safety work before implementation. The current SQLite highlight and library-override data must be migrated without loss.

- [ ] Establish a collision-safe, identifiable Syllex-managed directory at the vault root; exclude it from course scans. Use versioned portable files and atomic writes, not a live SQLite database in the vault.
- [ ] Move or mirror highlights and library hidden/display-name choices into portable vault data with safe migration from existing app-data databases. Keep last page, selected vault path, and UI preferences per device.
- [ ] Add a separate Flashcards tab with independent decks and plain-text card add/edit/delete.
- [ ] Support one optional plain-text tag per card, suggested from vault course/module names or typed manually; leave tags unchanged when those names change.
- [ ] Review a deck or a selection of tags with optional shuffle and session-only Known/Unknown. Finish with End, Restart all, or Retake missed; do not implement spaced repetition.
- [ ] Import/export flashcards with a chosen question/answer separator and newline default between cards; preview validation and duplicates before import. Resolve the intentionally open multiline-record rule before parser implementation.
- [ ] Verify manual vault-copy portability between Fedora and Windows, including missing and changed module references, collisions, and interrupted writes.

## M7 — Markdown reading and companion notes

- [ ] Render existing `.md` course modules safely and read-only inside the library.
- [ ] Create one Markdown companion note for a module on first opening its Notes pane, inside the managed vault directory.
- [ ] Default to a side-by-side document and rendered, directly editable note; offer document-only, note-only, and raw Markdown modes.
- [ ] Autosave text-focused notes with status, atomic writes, and external-conflict handling.
- [ ] Keep notes discoverable through their module and provide an Unlinked Notes recovery/relink view when a target disappears.
- [ ] Verify source immutability and note portability across Fedora and Windows.

## M8 — Personal release hardening and packaging

- [ ] Watch the selected vault for external changes and refresh the library automatically, retaining manual Refresh as fallback.
- [ ] Show a reload notice when an open document changes on disk.
- [ ] Complete disposable cache management and presentation cleanup.
- [ ] Build and smoke-test Fedora RPM/AppImage and a native Windows 11 installer.
- [ ] Complete a manual cross-platform checklist for offline use, portability, accessibility, and source-file safety.

## M9 — Later vault archive and reading enhancements

- [ ] Export a full-vault ZIP to a user-selected external location without changing course files; define guided restore and collision handling separately.
- [ ] Add page bookmarks, note page links, and richer annotations after their requirements are settled.

## M10 — Later search improvements

- [ ] Index PDF text locally and navigate to precise visible hits.
- [ ] Add fuzzy catalog search and search across Markdown notes and flashcards.

## M11 — Additional platforms (future)

Mobile and other platforms remain possible. Supported platforms, feature scope, and local file access require decisions before implementation. Fedora and Windows 11 remain the personal-release targets.
