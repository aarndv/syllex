# Syllex

Syllex is a contraction of syllabus and index, conveying a structured academic repository without leaning on literal words like vault or course.

Syllex is a fast, local-first desktop study application for organizing and reading college course modules. It opens a user-selected directory, called a vault, similarly to an Obsidian vault; groups modules by course; displays PDF files; converts PowerPoint presentations into cached PDFs when LibreOffice is available; and provides reversible document dark modes. It also includes locally stored flashcard decks imported from a documented CSV format.

The application is intended to run on Fedora Linux and Windows 11. Original course files remain under the user's control and must never be modified by the application.

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

Active MVP implementation. The Tauri application includes vault selection and scanning, PDF viewing and search, reversible document filters, and cached PowerPoint preview conversion through LibreOffice. Flashcards and release hardening remain future roadmap work. See [docs/ROADMAP.md](docs/ROADMAP.md) for milestone status and [docs/PDF_VIEWER_BUG_REPORT.md](docs/PDF_VIEWER_BUG_REPORT.md) for the PDF rendering regression record.

## Documentation map

| Document | Purpose |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Binding instructions for coding agents |
| [docs/PRODUCT.md](docs/PRODUCT.md) | Requirements, scope, and non-goals |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical boundaries and system structure |
| [docs/DESIGN.md](docs/DESIGN.md) | Visual theme, UX principles, and handoff guidelines |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Initial SQLite entities and ownership rules |
| [docs/FILE_FORMATS.md](docs/FILE_FORMATS.md) | Supported modules and flashcard import format |
| [docs/SECURITY.md](docs/SECURITY.md) | Filesystem, subprocess, and privacy requirements |
| [docs/TESTING.md](docs/TESTING.md) | Test strategy and platform matrix |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Ordered delivery milestones |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Architecture decision log |
| [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md) | How to assign and verify AI-assisted work |

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
