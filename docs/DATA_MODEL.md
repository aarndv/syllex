# Data Model

This document distinguishes the current implementation from the approved personal-release model. It is not a final portable-file schema. Database changes still require versioned migrations.

## Ownership

| Data | Current implementation | Personal-release owner |
| --- | --- | --- |
| Original PDF, PPT/PPTX, and course `.md` modules | User-selected vault | User-selected vault; Syllex never rewrites them |
| Selected vault path and last-read page | Platform app-data SQLite (`metadata.sqlite3`) | Platform app data, per device |
| Display and viewer preferences | Webview local storage | Per-device storage; migration to app-data SQLite remains separate work |
| Highlights | Platform app-data SQLite (`highlights.sqlite3`) | Versioned portable files in the managed vault-root directory |
| Hidden items and display-name overrides | Platform app-data SQLite (`metadata.sqlite3`) | Versioned portable files in the managed vault-root directory |
| Flashcard decks and cards | Not implemented | Versioned portable files in the managed vault-root directory |
| Companion notes | Not implemented | One Markdown file per module in the managed vault-root directory |
| Converted presentations and thumbnails | Application cache | Application cache; disposable and never transferred as study data |

The managed directory uses `.syllex` when that name is free or already identifiable as Syllex-owned. An unrelated collision must be left untouched and a discoverable alternate chosen. Its exact marker, schema, layout, and migration protocol are M6 design work. Do not put a live SQLite database in the vault or treat copied portable files as trusted. Manual copying of the vault is the supported first-release transfer path.

## Device-local records

### selected_vault

The canonical root path is device-specific. Issue #31 stores it in `metadata.sqlite3` under platform app data; a missing root remains recorded for recovery. A copied vault on another device is selected through the normal directory picker.

### reading_progress

The current versioned migration stores a validated canonical `document_path` and `last_page` in platform app data. Progress for equal relative filenames in different vaults stays separate. Zoom and scroll position are not currently persisted. Reading position is intentionally not part of the portable vault data.

### preferences

The current webview settings include `pageSidebarVisible`, `pageSidebarDock`, `pageSidebarWidth`, `thumbnailScale`, and `pageSidebarLayoutVersion`; `syllex_highlight_color` stores the last selected color. These are device-local preferences. Their later migration to app-data SQLite is separate from portable study data.

## Portable vault records

All module references in portable records must be vault-relative, validated on use, and portable between Fedora and Windows. Do not serialize a source device's absolute path. A missing or changed module must not cause a note or highlight to attach silently to another file. The exact identity and recovery format will be specified in M6 before implementation.

### library_overrides

For a vault-relative module or folder path:

- optional display name
- hidden flag

The current migration 2 stores these in SQLite keyed by canonical vault root and relative item path. M6 must migrate them safely to portable vault data, retaining the originals until verified. Hiding a folder hides its descendants in the library view; no disk file is removed.

### highlights

For a validated module:

- unique highlight action ID
- vault-relative module reference
- page number
- color from the supported palette
- one or more normalized page rectangles
- creation time

The current versioned `highlights.sqlite3` database uses canonical `document_path` and `rects_json`. M6 must migrate these records safely without losing geometry or colors. Highlights remain view overlays; no source PDF or converted presentation is edited. Thumbnails remain disposable cache content.

### flashcard_decks and cards

Decks are independent of courses and modules. A card belongs to one deck and contains:

- stable card ID
- plain-text question/front and answer/back
- zero or one optional plain-text tag
- creation and update timestamps as needed for safe edits

Tags may be suggested from course and module names or typed by the user. They are not path links and do not automatically change on a course or module rename. Review may select one deck or one or more tags across decks. Known/Unknown, order, and shuffle state exist only during the current session; no ease factor, interval, due date, or durable review history is required for the personal release.

### companion_notes

Each module can have one app-created Markdown note under the managed directory. Associate it with a validated vault-relative module identity; keep its content as a separate `.md` file. Create it on first opening the module's Notes pane. If the module disappears, preserve the note and expose it in Unlinked Notes for recovery and relinking. Autosave must detect external edits and preserve the last good version on failure.

## Later entities

Page bookmarks, note page anchors, multiple card tags, and review history remain possible later features. Full-vault ZIP export may include the portable managed directory and original course hierarchy, but is not a personal-release gate.

## Migration rules

- Never edit a released SQLite migration. Add a versioned forward migration for database changes.
- Specify and version the portable file schema before writing it. Validate copied data and reject unsupported versions safely.
- Migrate existing highlight and library-override records without deleting their source until the portable copy has been verified.
- Use atomic writes for app-owned vault data and preserve the last good version on failure or conflict.
- Test upgrade and manual vault-copy roundtrips on Fedora and Windows with missing, changed, and colliding paths.
