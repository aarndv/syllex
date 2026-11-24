# File Formats

## Course modules

- `.pdf`: displayed through PDF.js
- `.ppt` and `.pptx`: converted to a cached PDF when LibreOffice is available
- `.md`: existing course Markdown modules are rendered read-only inside Syllex

App-created companion notes are separate `.md` files in Syllex's managed vault-root directory. They are edited only through the note workflow and do not appear as ordinary course modules. Extension checks are only an initial filter; all file content remains untrusted.

## Managed vault data

The portable store uses `.syllex` at the vault root when free. If that name belongs to unrelated content, Syllex chooses the first free `.syllex-N` directory. Discovery scans root entries for the exact `owner` marker text `syllex-folder-order-v1` (retained for compatibility with existing folder orders); copying the whole vault preserves the chosen name and marker. An unrelated entry is left untouched. Managed directories are hidden from ordinary module scans.

The directory has a `manifest.json` with `format: "syllex-portable"`, `version: 1`, and `path_format: "vault-relative-posix-v1"`. Existing `folder-order.json` remains supported. `records/study.json` atomically groups migrated highlights and library overrides; `records/cards.json` is reserved for later flashcards. Each record has an outer `version: 1` and a `data` value. `notes/` is reserved for individual Markdown companion notes. These files are created only when their features use them. No live SQLite database, generated preview, or converted document belongs here.

Portable module identities are vault-relative paths with `/` separators and exact case, such as `Course/Unit 1/Lecture.pdf`. They contain no absolute prefix, `.` or `..` segment, empty segment, backslash, control character, Windows-forbidden character, trailing dot or space, or Windows device name. A missing referenced module remains unlinked; Syllex must not guess a new match by filename or case. Reading position, selected vault path, and preferences stay in device-local app data.

Rust validates the marker, manifest, record version, path boundaries, and regular-file status before use. Writes stage a file in the managed directory and replace it atomically after syncing; a revision hash guards against replacing edits made since the last read. Each manifest or record retains a `.json.bak` copy of the last known-good bytes. Invalid, corrupt, or newer files are reported and preserved for recovery; Syllex never silently substitutes the backup. Schema details for cards and note naming belong to their respective feature issues. Existing SQLite highlights and overrides remain intact as a migration recovery source.

`records/study.json` has `data.highlights` and `data.library` maps keyed by vault-relative module paths. A highlight set stores the source module's SHA-256 and its existing highlight IDs, pages, colors, and normalized rectangles. A library entry stores its display name, hidden flag, folder flag, and source SHA-256 for files. The migration writes both maps in one snapshot, verifies them, and leaves the old SQLite databases intact. Subsequent edits update the portable snapshot. A changed or missing referenced file is reported for recovery rather than matched to another file. Folder references are checked by path and type. The selected vault, reading position, and preferences remain device-local.

## Flashcard import and export

Flashcards are plain-text question/answer pairs. An import must ask the user for the separator between question and answer; separate cards default to newline separation. The format must not assume comma-only CSV. Syllex previews parsed cards, errors, and duplicates before any confirmed write. Blank questions or answers and malformed or unsupported input must produce actionable explanations. Cancel or validation failure writes nothing.

The owner intentionally deferred the rule for a newline *inside* a question or answer. Escaping, quoting, alternate record separators, and import mapping for deck/tag metadata remain open design details. Do not silently choose a parser rule or claim arbitrary multiline input is supported. Export should be compatible with the finalized import format and use a user-selected destination outside the vault.

## Later full-vault archive

A full-vault ZIP export is planned after the personal release. It should include original course files and the managed Syllex directory, omit live databases and disposable caches, and be written to a user-selected external location. Restore, collision handling, and cross-platform path normalization require their own reviewed design before implementation.
