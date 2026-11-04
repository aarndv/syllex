# Product Requirements

## Problem and goal

Course modules are spread across PDFs, presentations, and Markdown files. Syllex turns a user-selected local course directory into an offline study library while leaving original course modules untouched.

## Target release

The next release is for the owner's own Fedora Linux and Windows 11 devices. Source development remains on Fedora; Windows is a native CI, packaging, and manual-validation target. Other platforms may be considered later and are not part of this release.

## Current reading library

- Select a vault; recursively discover PDF, PPT/PPTX, and Markdown modules; group first-level folders as courses.
- Copy a new module into the vault without overwriting an existing file. Hide or change an item's Syllex display name without changing its source file.
- Read PDFs and cached LibreOffice-converted presentations, navigate and search pages, use reversible viewing filters, resume at the last page, and create persistent overlay highlights.
- Search the catalog and PDF text. Indexed full-text search and search across notes or flashcards are later work.

The current implementation is still being hardened. In particular, opening originals in the system application and rendering Markdown modules as full documents remain planned release work; a documented capability is not evidence that its UI is finished.

## Personal-release capabilities

1. Keep PDF reading and flashcards useful offline without LibreOffice. Provide Open Original for modules when internal preview is unavailable or unwanted.
2. Store portable, vault-owned notes, flashcards, highlights, and library hidden/display-name choices in a collision-safe Syllex-managed directory at the vault root. Copying the vault folder transfers these data between Fedora and Windows without transferring a live SQLite database. Migrate existing highlights and library overrides without data loss. Keep last-read page, selected vault path, and display preferences per device.
3. Add a separate Flashcards tab. Decks are independent of courses and modules. Create, edit, and delete plain-text cards. Each card belongs to one deck and may have one optional plain-text tag. Suggest course and module names while tagging, and permit typed tags. Tags do not update automatically when folders or modules are renamed.
4. Review one deck or cards selected by one or more tags, with optional shuffle. Known and Unknown apply only to the current session. At its end, offer End, Restart all, and Retake missed. There is no spaced repetition or durable review rating in this release.
5. Import and export flashcards. Import asks for the question/answer separator; the default separator between cards is a newline. Show a validation and duplicate preview before writing. The rule for line breaks inside a question or answer is intentionally unresolved and must be decided before implementing that parser. Do not assume CSV-only input.
6. Give each module one companion Markdown note, created when its Notes pane first opens. Keep the document and rendered, directly editable note side by side by default, with document-only and note-only options and a raw Markdown editing control. Text-focused Markdown is sufficient; images and attachments are later possibilities. Autosave with visible status, detect external edit conflicts, and preserve unlinked notes for recovery/relinking when a module disappears. Show notes through their module, except in the Unlinked Notes recovery view.
7. Detect external vault additions, removals, moves, and renames automatically. Preserve the current reading session where possible and show a reload notice before replacing an open document that changed on disk. Manual Refresh remains a fallback.
8. Package and manually validate the personal release on Fedora Linux and Windows 11. Never modify, rename, move, delete, or overwrite original course modules through these workflows.

## Later capabilities

- Full-vault ZIP export and guided restore to a user-selected location; manual folder copies are enough for the personal release.
- Page links inside notes, bookmarks, richer annotations, and multiple card tags.
- Indexed search across documents, notes, and flashcards; Smart Dark rendering.
- Conflict-aware automatic synchronization and additional platforms, including a possible mobile version, only after separate product and security decisions.

## Non-goals for the personal release

- Editing original PDFs, presentations, or existing course Markdown modules
- Reproducing presentation animations or transitions
- Accounts, telemetry, cloud storage, a web server, remote AI, or automatic synchronization
- Collaborative study, OCR, or a mobile/browser version
- Spaced repetition and persistent Known/Unknown ratings

## Success criteria

- The owner can select a vault, open a PDF, and study offline on Fedora and Windows 11.
- Flashcard data, companion notes, highlights, and library organization survive copying the vault folder across those devices without absolute-path mismatches or a synchronized live database.
- A note or card edit survives restart; failed or conflicting writes preserve the last good data. Missing modules never cause their notes or highlights to be silently attached to a different file.
- External file changes update the library, and changes to an open document require a deliberate reload.
- Invalid imports explain the affected records and write nothing before confirmation.
- Missing LibreOffice does not block PDF reading, notes, or flashcards.
- No original course module is changed by Syllex.
