# Architecture

## System overview

Syllex is a local desktop application with a web-based interface and a trusted native layer.

```text
React + TypeScript UI
        |
Typed Tauri commands/events
        |
Rust native layer
   |              |             |
Course vault   App-data SQLite  LibreOffice
(read-only     (device-local)    conversion
 modules;       |                  |
 managed       preferences     App cache -> PDF.js
 study data)
```

## Responsibility boundaries

### React frontend

- Navigation and presentation
- Course and module lists
- PDF.js viewer integration
- Flashcard editor, import preview, tag selection, and session-only review
- Rendered Markdown companion-note editor and raw Markdown mode
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
- Atomic, scoped writes to Syllex-owned portable study files inside the selected vault

### SQLite

Live SQLite databases stay in platform application data and never enter the vault. The current issue #10 highlights and issue #34 library overrides use versioned app-data databases; M6 migrates those records to portable vault files. Selected vault path and reading position remain device-local. React/PDF.js owns highlight overlay geometry and page-preview rendering. The scan skips linked entries, tracks visited directories, and returns warnings for entries it cannot inspect; React displays those warnings with the visible library.

### Managed vault data

An identifiable, collision-safe Syllex directory at the selected vault root stores versioned portable flashcards, highlights, library overrides, and one Markdown companion note per module. It is excluded from normal module scans. Original course modules remain read-only to Syllex; writes are restricted to app-created study data and explicit safe module-copy/folder-creation operations. Rust validates paths and module references, detects external edits, and writes portable files atomically. Manual folder copies move study data between Fedora and Windows without syncing a live SQLite database. Exact schema and identity rules are M6 design work.

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
- Store per-device vault paths, reading progress, and live databases in platform application data; use vault-relative identities in portable study files.
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

## File watching

The first personal release watches only the selected vault and refreshes the visible library after external changes. Validate watcher paths, debounce bursts, and keep manual Refresh available when watching fails. An open document that changes on disk shows a reload notice; Syllex does not replace the reader contents without the user's action. Notes use separate external-change conflict handling before autosave.

## Error model

Native commands should return structured, user-safe errors with a stable code and readable message. Internal causes may be logged only when they contain no document contents or unnecessary personal paths.
