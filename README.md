# Syllex

Syllex is a personal study library for the course materials already on your computer. Choose your course folder as a vault, much like an Obsidian vault, and browse your classes and readings together. It gives you a comfortable place to read, keep your place, and return to the passages you've highlighted.

Syllex works offline and leaves your original course files untouched. It is designed for Fedora Linux and Windows 11.

The name combines *syllabus* and *index*.

## Key features

- **Course vault:** Choose an existing folder and browse your modules by course.
- **Document reading:** Read PDFs and preview presentation slides when available. Navigate pages, zoom, search, and resume where you left off.
- **Page previews and highlights:** Jump between pages, mark text or page areas in multiple colors, and return to saved highlights. An eraser lets you remove marks you no longer need.
- **Reading filters:** Switch between original, dark, and other viewing modes without changing the source document.
- **Local control:** Work offline, keep your original files untouched, and open them in your system application whenever you prefer.

## Project status

Syllex is in active MVP development. Flashcards and release hardening are planned; see the [roadmap](docs/ROADMAP.md) for the current scope.

## Run locally

### Linux (Fedora KDE)

Install Node.js, npm, Rust, and the Linux system dependencies required by Tauri 2. From the repository root, run:

```bash
npm ci
npm run tauri dev
```

### Windows 11

Syllex is intended to run as a native Windows desktop application. Use a Windows package from a native build when one is available; installer packaging and validation are tracked in [M8](docs/ROADMAP.md). Source development takes place on Fedora KDE.

On either platform, PowerPoint previews require LibreOffice installed locally. PDF reading works without it.

Checks on the Fedora development machine:

```bash
npm run build
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

## Technology

Syllex uses Tauri 2, React, TypeScript, Vite, Rust, SQLite, and PDF.js. The [architecture](docs/ARCHITECTURE.md) explains how the desktop interface, native filesystem operations, and local metadata fit together.

## Documentation

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
| [docs/PDF_VIEWER_BUG_REPORT.md](docs/PDF_VIEWER_BUG_REPORT.md) | PDF rendering regression record |

## License

No license has been selected. This repository is private and all rights are reserved until the owner adds one.
