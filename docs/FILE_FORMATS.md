# File Formats

## Course modules

- `.pdf`: displayed through PDF.js
- `.ppt` and `.pptx`: converted to a cached PDF when LibreOffice is available
- `.md`: existing course Markdown modules are rendered read-only inside Syllex

App-created companion notes are separate `.md` files in Syllex's managed vault-root directory. They are edited only through the note workflow and do not appear as ordinary course modules. Extension checks are only an initial filter; all file content remains untrusted.

## Managed vault data

The personal release uses an identifiable, collision-safe `.syllex` directory at the vault root, or a discoverable alternate if that name is occupied by unrelated content. It contains versioned portable flashcard, highlight, and library-override data plus individual Markdown companion notes. Copying the vault transfers these files. The exact marker, file layout, schema version, and module identity rules must be specified in M6 before implementation. No live SQLite database, generated preview, or converted document belongs here.

## Flashcard import and export

Flashcards are plain-text question/answer pairs. An import must ask the user for the separator between question and answer; separate cards default to newline separation. The format must not assume comma-only CSV. Syllex previews parsed cards, errors, and duplicates before any confirmed write. Blank questions or answers and malformed or unsupported input must produce actionable explanations. Cancel or validation failure writes nothing.

The owner intentionally deferred the rule for a newline *inside* a question or answer. Escaping, quoting, alternate record separators, and import mapping for deck/tag metadata remain open design details. Do not silently choose a parser rule or claim arbitrary multiline input is supported. Export should be compatible with the finalized import format and use a user-selected destination outside the vault.

## Later full-vault archive

A full-vault ZIP export is planned after the personal release. It should include original course files and the managed Syllex directory, omit live databases and disposable caches, and be written to a user-selected external location. Restore, collision handling, and cross-platform path normalization require their own reviewed design before implementation.
