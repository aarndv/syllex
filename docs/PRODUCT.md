# Product Requirements

## Problem

Course modules are distributed across many PDFs and PowerPoint files. Opening them through ordinary file managers is fragmented, document brightness can be uncomfortable, and study materials and flashcards are separated from the modules they reference.

## Goal

Provide a fast desktop application that turns a local course directory into an organized, offline study library without taking ownership of the user's files.

## Target user

A college student using Fedora Linux and Windows 11 who stores course modules locally and wants one place to read modules and review imported flashcards.

## MVP capabilities

1. Select and remember one local course directory, called a vault.
2. Treat first-level directories as courses by default.
3. Recursively discover supported documents without modifying them.
4. Display PDFs internally with navigation, zoom, search, and remember the last opened page to resume reading (no explicit completion status).
5. Provide Original and Fast Dark viewing modes.
6. Convert PPT/PPTX files to cached PDFs when LibreOffice is available.
7. Allow opening the original document in its system application.
8. Import flashcards from a validated CSV file with a preview before saving.
9. Store settings, progress, and flashcards locally in SQLite.
10. Review flashcards using a basic spaced repetition algorithm with simple "Mark Known/Unknown" flagging to prioritize crucial questions.
11. Export study data to a user-selected external location to keep the vault pristine.
12. Operate without an internet connection.

## Later capabilities

- Smart WebGL-based document dark mode
- Bookmarks and annotations
- Multiple vaults
- Full-text indexing across documents
- Explicit progress/flashcard import
- Optional synchronization designed to handle conflicts safely

## Non-goals for the MVP

- Editing PDFs or PowerPoint files
- Reproducing PowerPoint animations or transitions
- Cloud accounts or real-time synchronization
- Collaborative study features
- Mobile or browser versions
- Automatic AI generation of flashcards
- OCR for scanned documents
- A finalized visual brand or design theme

## Success criteria

- The application starts promptly on representative Fedora and Windows machines.
- A user can select a vault and open a PDF without configuration beyond the first directory choice.
- No workflow modifies the source module.
- A previously converted presentation reopens from cache when unchanged.
- Invalid flashcard imports are rejected with row-specific explanations.
- Missing LibreOffice does not prevent use of unrelated features.


