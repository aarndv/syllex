# Architecture Decision Log

Record decisions that are expensive to reverse or affect multiple parts of the application. Do not use this file for routine implementation details.

## D-001 — Tauri 2 desktop shell

**Status:** Accepted

**Decision:** Use Tauri 2 rather than Electron for the desktop shell.

**Reason:** The project prioritizes a small, fast local desktop application and needs controlled native filesystem and subprocess access.

**Consequences:** Native behavior is implemented in Rust, and WebKitGTK/WebView2 differences require cross-platform testing.

## D-002 — Local-first storage

**Status:** Accepted

**Decision:** Core use requires no server or account. Store application metadata in a per-device SQLite database.

**Reason:** Offline availability and user control are primary requirements.

**Consequences:** Cross-device synchronization is deferred and must later use an explicit conflict-aware design.

## D-003 — Source documents are immutable

**Status:** Accepted

**Decision:** The application never rewrites course modules. Conversions and thumbnails live in cache.

**Reason:** The course directory remains the user's source of truth.

**Consequences:** Dark mode is a rendering effect, and presentation previews require cached derivatives.

## D-004 — PowerPoint preview through LibreOffice

**Status:** Accepted for MVP

**Decision:** Use an installed LibreOffice executable to convert PPT/PPTX files into cached PDFs.

**Reason:** Direct browser rendering is unreliable, while PDF.js provides one consistent viewer after conversion.

**Consequences:** Animations and interactive slide behavior are not preserved. The application must work without LibreOffice and provide Open Original.

## D-005 — Visual theme deferred

**Status:** Superseded by D-011

**Decision:** Implement accessible structural UI without establishing a visual theme or broader visual identity.

**Reason:** The product name, Syllex, is established, but the owner has not selected a visual direction.

**Consequences:** Agents must avoid premature palette, icon, logo, and other visual identity decisions.

## D-006 — Single-device development

**Status:** Accepted

**Decision:** All source development occurs on the Fedora KDE laptop. Windows 11 remains a supported runtime and validation target.

**Reason:** A single development machine avoids toolchain drift, unfinished-work handoffs, and working-tree conflicts while keeping the workflow simple.

**Consequences:** Fedora hosts the development toolchain and local checks. Windows builds are produced by native CI runners and periodically installed on the Windows 11 PC for manual platform testing. The Windows PC does not need a development checkout or compiler toolchain unless this decision changes later.

## D-NNN — Title

**Status:** Proposed | Accepted | Superseded

**Decision:** What is being decided?

**Reason:** Why is this choice appropriate?

**Alternatives:** What credible alternatives were considered?

**Consequences:** What becomes easier, harder, or constrained?

## D-007 — Single vault MVP

**Status:** Accepted

**Decision:** The first public release (MVP) will only support a single vault. Multiple vaults are deferred.

**Reason:** Keeps the initial architecture simple and focuses on core features first without adding the complexity of vault switching.

**Consequences:** Less UI and state management overhead. Multiple vaults will be a later capability.

## D-008 — Implicit reading progress

**Status:** Accepted

**Decision:** Reading progress will be tracked by remembering the last page opened, without tracking an explicit "completed" status.

**Reason:** Users generally just want to resume reading from where they left off. Formal tracking isn't necessary for unstructured course materials.

**Consequences:** Eliminates the need to define exact percentage thresholds or manual "mark as complete" buttons.

## D-009 — Basic spaced repetition

**Status:** Accepted

**Decision:** Implement a basic spaced repetition algorithm using simple "Mark Known/Unknown" flags.

**Reason:** Balances the MVP scope with effective study habits by prioritizing crucial questions while keeping the interaction simple.

**Consequences:** The `flashcards` table will store spaced repetition data (e.g., interval, ease factor). 

## D-010 — External exports

**Status:** Accepted

**Decision:** Portable export files (like flashcard backups or study progress) must be saved outside the vault at a user-selected location.

**Reason:** Prevents the vault from being cluttered with metadata files and avoids indexing export files during recursive scans.

**Consequences:** The application must trigger standard "Save As" OS dialogs for all export workflows.

## D-011 — Visual Theme Direction: Warm Academic Library

**Status:** Accepted

**Decision:** Establish a Warm Academic Library theme featuring Deep Forest Green (`#1b3627`), Soft Parchment/Cream (`#fbf9f4`), Warm Gold/Amber (`#d97706`), and full Academic Serif typography across all UI elements. Course cards are styled as library index cards.

**Reason:** Creates an authentic, cozy, and distinguished academic atmosphere tailored for college students reading modules and studying.

**Consequences:** Frontend CSS styling and components must adhere to the serif typography and parchment-forest green color scheme.

## D-012 — Markdown self-notes and module imports

**Status:** Accepted

**Decision:** Support `.md` files as discoverable course modules and provide an explicit "Add Module" dialog that copies chosen `.pdf`, `.ppt`, `.pptx`, or `.md` files into a course directory within the vault.

**Reason:** Enables students to add new modules and keep personal markdown notes alongside course materials without breaking the rule that existing files are never overwritten or modified silently.

**Consequences:** The scanner must recognize `.md` files, and a native file copy command must validate target paths to ensure copied files stay within the selected vault.

## D-013 — Evidence-driven technology changes

**Status:** Accepted

**Decision:** Treat the documented technology stack as a preferred baseline rather than an immutable constraint. A major component or dependency may be replaced when observed behavior shows that the current approach cannot reliably satisfy product requirements. The replacement must be recorded here with its evidence, alternatives, platform impact, security impact, and migration consequences.

**Reason:** Repeatedly patching an unsuitable implementation can increase complexity without improving reliability. The project should be able to adopt a better-supported local technology when necessary while keeping product and security invariants stable.

**Alternatives:** Permanently lock the original stack, or allow unrecorded ad hoc changes. A permanent lock prevents necessary corrections; unrecorded changes make maintenance and review unsafe.

**Consequences:** Technology changes no longer require separate case-by-case permission when they are necessary and documented. Local-first operation, source immutability, Fedora and Windows support, filesystem boundaries, and the prohibition on unapproved network features remain mandatory.

## D-014 — Use PDF.js maintained viewer components

**Status:** Accepted

**Decision:** Replace Syllex's custom React canvas scheduler with PDF.js's maintained `PDFViewer` and `PDFSinglePageViewer` components. React continues to own the surrounding toolbar and application state; PDF.js owns page DOM, rendering priority, cancellation, canvas reuse, and the bounded page-view buffer.

**Reason:** Multiple iterations of custom `page.render()` lifecycle, viewport observation, buffering, and font timing logic did not resolve incomplete or displaced pages. PDF.js already provides a production viewer layer specifically for those responsibilities.

**Alternatives:** Continue patching the custom canvas renderer; embed the webview's browser PDF plugin; or replace PDF.js with a native MuPDF/Poppler image-rendering pipeline. Browser PDF plugins are inconsistent between WebKitGTK and WebView2. A native engine remains a viable next step but adds native dependencies, packaging work, and a larger security-review surface.

**Consequences:** Syllex removes its custom page renderer and uses the upstream rendering queue in both single-page and continuous modes. Existing navigation, zoom, search navigation, progress persistence, and reversible canvas filters remain React-controlled. If the same source PDFs still fail in this maintained viewer, evaluate a native rendering engine under D-013 rather than adding another custom PDF.js scheduler.
