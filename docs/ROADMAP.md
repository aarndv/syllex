# Roadmap

Only one milestone should be active at a time. Each milestone should be reviewed and committed before the next begins.

## M0 — Repository baseline

- [x] Establish product and architecture documentation
- [x] Establish agent, security, and testing rules
- [ ] Review unresolved questions with the owner
- [ ] Initialize Git and commit the documentation baseline

## M1 — Application scaffold

Acceptance criteria:

- [x] Tauri 2, React, TypeScript, and Vite application starts on Fedora
- [x] Formatting, linting, type-checking, and basic tests are configured
- [x] Rust formatting, Clippy, and tests are configured
- [x] No product feature or permanent visual theme is added
- [x] Initial application also compiles on a Windows CI runner

## M2 — Read-only vault selection and scan

- [x] Select a directory through a native dialog
- [x] Persist the selected vault in platform app data
- [x] Recursively discover supported modules
- [x] Group first-level folders as courses
- [x] Handle missing, inaccessible, and empty vaults
- [x] Prove through tests that source modules are never modified

## M3 — Basic PDF viewer

- [x] Open PDFs through PDF.js
- [x] Navigate pages and zoom
- [x] Render pages lazily
- [x] Remember the last page locally
- [x] Handle malformed or protected PDFs

## M4 — Fast document dark mode

- [x] Add Original and Fast Dark modes
- [x] Keep the operation reversible and view-only
- [x] Test text-heavy, illustrated, and already-dark documents

## M5 — PowerPoint conversion

- [x] Detect LibreOffice on Fedora and Windows
- [x] Convert PPT/PPTX into the application cache
- [x] Reuse valid cached conversions
- [x] Provide Open Original and useful failure states
- [x] Test shell-injection-resistant argument handling

## M6 — Flashcards

- [ ] Add SQLite migrations for decks and cards
- [ ] Import the documented CSV format
- [ ] Preview valid rows, duplicates, and errors
- [ ] Require confirmation before saving
- [ ] Provide a basic review flow

## M7 — Release hardening

- [ ] File watching and index refresh
- [ ] Cache management
- [ ] Fedora RPM or AppImage packaging
- [ ] Windows installer packaging
- [ ] Manual platform test checklist
- [ ] Backup/export plan for user-created study data
