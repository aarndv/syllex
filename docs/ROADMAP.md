# Roadmap

Only one milestone should be active at a time. Each milestone should be reviewed and committed before the next begins.

## M0 — Repository baseline

- [x] Establish product and architecture documentation
- [x] Establish agent, security, and testing rules
- [ ] Review unresolved questions with the owner
- [ ] Initialize Git and commit the documentation baseline

## M1 — Application scaffold

Acceptance criteria:

- [ ] Tauri 2, React, TypeScript, and Vite application starts on Fedora
- [ ] Formatting, linting, type-checking, and basic tests are configured
- [ ] Rust formatting, Clippy, and tests are configured
- [ ] No product feature or permanent visual theme is added
- [ ] Initial application also compiles on a Windows CI runner

## M2 — Read-only vault selection and scan

- [ ] Select a directory through a native dialog
- [ ] Persist the selected vault in platform app data
- [ ] Recursively discover supported modules
- [ ] Group first-level folders as courses
- [ ] Handle missing, inaccessible, and empty vaults
- [ ] Prove through tests that source modules are never modified

## M3 — Basic PDF viewer

- [ ] Open PDFs through PDF.js
- [ ] Navigate pages and zoom
- [ ] Render pages lazily
- [ ] Remember the last page locally
- [ ] Handle malformed or protected PDFs

## M4 — Fast document dark mode

- [ ] Add Original and Fast Dark modes
- [ ] Keep the operation reversible and view-only
- [ ] Test text-heavy, illustrated, and already-dark documents

## M5 — PowerPoint conversion

- [ ] Detect LibreOffice on Fedora and Windows
- [ ] Convert PPT/PPTX into the application cache
- [ ] Reuse valid cached conversions
- [ ] Provide Open Original and useful failure states
- [ ] Test shell-injection-resistant argument handling

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
