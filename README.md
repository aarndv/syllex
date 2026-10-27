# Syllex

Syllex is a personal study library for the course materials already on your computer. Choose your course folder as a vault, much like an Obsidian vault, and browse your classes and readings together. It gives you a comfortable place to read, keep your place, and return to the passages you've highlighted.

Syllex works offline and leaves your original course files untouched. It is designed for Fedora Linux and Windows 11.

The name combines *syllabus* and *index*.

## Planned technology

- Tauri 2 desktop shell
- React, TypeScript, and Vite frontend
- Rust for trusted filesystem and process operations
- SQLite for local application metadata
- PDF.js for PDF rendering
- LibreOffice headless mode for optional PowerPoint-to-PDF conversion
- Vitest, Rust tests, and end-to-end tests

## Product principles

- Local-first and usable offline
- Fast startup and responsive document navigation
- Original modules remain untouched
- Linux and Windows are first-class targets
- Features are delivered in small, testable milestones
- No cloud account or server is required for the initial release

## Current status

Active MVP implementation. The Tauri application includes vault selection and scanning, PDF viewing and search, page previews and persistent viewer highlights, reversible document filters, and cached PowerPoint preview conversion through LibreOffice. Flashcards and release hardening remain future roadmap work. See [docs/ROADMAP.md](docs/ROADMAP.md) for milestone status and [docs/PDF_VIEWER_BUG_REPORT.md](docs/PDF_VIEWER_BUG_REPORT.md) for the PDF rendering regression record.

## Documentation map

| Document | Purpose |
| --- | --- |
| [docs/PRODUCT.md](docs/PRODUCT.md) | Requirements, scope, and non-goals |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical boundaries and system structure |
| [docs/DESIGN.md](docs/DESIGN.md) | Visual theme, UX principles, and handoff guidelines |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Initial SQLite entities and ownership rules |
| [docs/FILE_FORMATS.md](docs/FILE_FORMATS.md) | Supported modules and flashcard import format |
| [docs/TESTING.md](docs/TESTING.md) | Test strategy and platform matrix |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Ordered delivery milestones |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Architecture decision log |

## Development platforms

Fedora KDE on the Linux laptop is the sole development environment. Windows 11 remains a supported runtime and validation target, using native Windows CI builds and periodic testing of packaged releases on the PC. Platform-specific behavior must be kept behind Tauri/Rust commands and tested on the actual target operating system.

## Repository setup

Before implementation begins:

1. Review every document in `docs/`.
2. Replace any unresolved assumptions with explicit decisions.
3. Initialize Git and create the documentation baseline commit.
4. Give the first agent only the scaffold milestone in `docs/ROADMAP.md`.
5. Review the generated diff before allowing feature work.

No license has been selected. Treat the repository as private and all rights reserved until the owner adds a license.
