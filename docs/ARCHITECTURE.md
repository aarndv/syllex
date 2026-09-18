# Architecture

## System overview

Syllex is a local desktop application with a web-based interface and a trusted native layer.

```text
React + TypeScript UI
        |
Typed Tauri commands/events
        |
Rust native layer
   |         |          |
Vault      SQLite    LibreOffice
(read)    metadata    conversion
        |
Application cache -> PDF.js viewer
```

## Responsibility boundaries

### React frontend

- Navigation and presentation
- Course and module lists
- PDF.js viewer integration
- Flashcard import preview and review interface
- Calling typed Tauri commands
- Displaying recoverable errors

### Rust/Tauri layer

- Native directory selection
- Scoped filesystem access
- Path validation and canonicalization
- Recursive indexing and file watching
- File identity and metadata calculation
- Safe LibreOffice invocation
- Cache management
- Opening files in system applications
- SQLite access when native ownership improves safety

### SQLite

Stores application-created metadata only. It does not store full module files.

### Application cache

Stores disposable generated artifacts such as PowerPoint-to-PDF previews and PDF thumbnails. Cache entries may be rebuilt from their sources.

## Module boundaries

Proposed frontend features:

```text
src/features/vault
src/features/library
src/features/viewer
src/features/flashcards
src/features/settings
```

Proposed native modules:

```text
src-tauri/src/commands
src-tauri/src/filesystem
src-tauri/src/indexing
src-tauri/src/conversion
src-tauri/src/database
src-tauri/src/platform
```

Do not create empty directories merely to match this proposal. Add a boundary when its first real behavior is implemented.

## Cross-platform policy

- Fedora KDE on the Linux laptop is the only development environment.
- Windows 11 remains a required runtime, native CI build, packaging, and manual validation target.
- Linux uses WebKitGTK; Windows uses WebView2.
- Build Linux packages on Linux and Windows packages on Windows or native CI runners.
- Store per-device vault paths in platform application data.
- Do not assume path separators, case sensitivity, drive letters, or executable locations.

## Presentation conversion

1. Check that the source remains inside the selected vault.
2. Create a cache key from stable source metadata.
3. Reuse a valid cached PDF when possible.
4. Invoke LibreOffice without a shell and with controlled output paths.
5. Validate that the expected PDF was produced.
6. Return a structured success or error result.
7. Never write output beside the source module.

## Dark-mode pipeline

- Original: unmodified PDF.js rendering.
- Fast Dark: reversible CSS/canvas filtering.
- Smart Dark, later: WebGL pixel processing with user-adjustable contrast.

The original document bytes are never rewritten.

## Error model

Native commands should return structured, user-safe errors with a stable code and readable message. Internal causes may be logged only when they contain no document contents or unnecessary personal paths.
