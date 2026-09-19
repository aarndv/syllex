# Agent Instructions

These instructions apply to the entire repository. A more deeply nested `AGENTS.md` may add stricter instructions for its directory but must not weaken this file.

## Before changing anything

1. Read `README.md` and all relevant files under `docs/`.
2. Inspect the existing repository and working tree.
3. Restate the requested scope and identify affected boundaries.
4. Ask before making a decision that changes product scope, storage ownership, privacy, supported platforms, or the selected technology stack.

Do not treat unresolved items as permission to invent requirements.

## Product invariants

- The application is local-first and must remain useful offline.
- Fedora Linux and Windows 11 are first-class desktop targets.
- All source development occurs on the Fedora KDE laptop.
- Windows 11 is a runtime, CI build, packaging, and manual validation target—not a second development environment.
- A user-selected course directory is the source of truth for modules.
- Never modify, rename, move, delete, or overwrite original course modules.
- Generated previews and conversions belong in the application cache.
- Application metadata belongs in the platform application-data directory.
- Do not synchronize a live SQLite database through a file-sync service.
- Do not introduce accounts, telemetry, advertisements, cloud storage, a web server, or remote AI features unless explicitly approved.
- Never use emojis for UI icons, buttons, labels, badges, or tree elements. Use clean SVG icons, CSS glyphs, or explicit typography labels.
- The Syllex name is established, but visual branding and theme are intentionally undecided. Do not invent a visual system.

## Approved baseline stack

- Tauri 2
- React with TypeScript
- Vite
- Rust for native capabilities
- SQLite for local metadata
- PDF.js for PDF rendering
- LibreOffice headless conversion for optional PPT/PPTX previews

Adding or replacing a major dependency requires an entry in `docs/DECISIONS.md` explaining the need, alternatives, and consequences.

## Architecture boundaries

- React owns presentation and user interaction.
- Rust owns trusted filesystem access, path validation, directory scanning, file watching, subprocess execution, and platform-specific integration.
- React must call small typed Tauri commands rather than directly reimplementing native behavior.
- Use Rust `Path` and `PathBuf`; never construct native paths through string concatenation.
- Keep OS-specific code behind explicit abstractions and conditional compilation.
- Database changes require versioned, tested migrations.
- Presentation conversion is optional; PDF viewing and flashcards must still work without LibreOffice.

## Security rules

- Scope filesystem access to directories the user explicitly selects.
- Canonicalize and validate paths before sensitive operations.
- Pass subprocess arguments as an argument array. Never interpolate a filename into a shell command.
- Treat PDFs, presentations, CSV files, filenames, and extracted metadata as untrusted input.
- Never print module contents or personal paths in ordinary logs.
- Do not add network access without explicit approval and a security review.
- Follow `docs/SECURITY.md`.

## Change discipline

- Work on one roadmap item or narrowly described task at a time.
- Always stage, commit, and push changes to git whenever a task or file change is made, unless explicitly instructed otherwise by the user.
- Prefer the smallest change that fully satisfies the task.
- Do not refactor unrelated code.
- Do not silently change documented requirements.
- Update affected documentation in the same change as behavior.
- Preserve user changes and never discard a dirty working tree.
- Do not commit generated caches, converted documents, databases, secrets, or user modules.

## Verification

Once the application is scaffolded, run every relevant available check before declaring completion:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

If a command is not configured yet, say so rather than claiming it passed. Run the native bundle build only when appropriate for the task and environment.

## Definition of done

A task is complete only when:

- Its acceptance criteria are met.
- Relevant automated checks pass.
- Error and empty states are considered.
- Linux/Windows impact is documented.
- No original course file can be changed by the new behavior.
- Documentation is updated where necessary.
- The final response identifies changed files, verification performed, and remaining limitations.
