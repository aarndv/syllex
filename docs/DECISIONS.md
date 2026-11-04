# Architecture Decision Log

Record decisions that are expensive to reverse or affect multiple parts of the application. Do not use this file for routine implementation details.

## D-001 — Tauri 2 desktop shell

**Status:** Accepted

**Decision:** Use Tauri 2 rather than Electron for the desktop shell.

**Reason:** The project prioritizes a small, fast local desktop application and needs controlled native filesystem and subprocess access.

**Consequences:** Native behavior is implemented in Rust, and WebKitGTK/WebView2 differences require cross-platform testing.

## D-002 — Local-first storage

**Status:** Accepted

**Decision:** Core use requires no server or account. Store device-specific application metadata in a per-device SQLite database. D-020 assigns selected portable study data to the vault.

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

**Decision:** The first personal release will use one active vault at a time. Multiple simultaneously active vaults are deferred.

**Reason:** Keeps the initial architecture simple and focuses on core features first without adding the complexity of vault switching.

**Consequences:** Less UI and state management overhead. Multiple vaults will be a later capability.

## D-008 — Implicit reading progress

**Status:** Accepted

**Decision:** Reading progress will be tracked by remembering the last page opened, without tracking an explicit "completed" status.

**Reason:** Users generally just want to resume reading from where they left off. Formal tracking isn't necessary for unstructured course materials.

**Consequences:** Eliminates the need to define exact percentage thresholds or manual "mark as complete" buttons.

## D-009 — Basic spaced repetition

**Status:** Superseded by D-021

**Decision:** Implement a basic spaced repetition algorithm using simple "Mark Known/Unknown" flags.

**Reason:** Balances the MVP scope with effective study habits by prioritizing crucial questions while keeping the interaction simple.

**Consequences:** The `flashcards` table will store spaced repetition data (e.g., interval, ease factor). 

D-021 removes scheduling and persistent ratings from the personal-release plan.

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

Issue #32 makes that copy atomic from the library's perspective: stage in the validated course directory and publish only when the destination name is unused. A collision or failed copy leaves existing modules unchanged. This applies to Fedora and Windows 11 and adds no network access or writes to external source files.

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

## D-015 — In-vault file and module renaming

**Status:** Superseded by D-019

**Decision:** Allow users to rename course module files and directories directly within the application vault through a safe, validated native rename operation.

**Reason:** Students organizing course materials need to correct typographical errors, standardize module numbering (e.g. `Lecture 01 - Intro.pdf`), and organize folders without leaving the application.

**Alternatives:** Keep source files read-only and implement visual alias metadata only in SQLite/localStorage. While an alias keeps files untouched on disk, external file managers and other tools would not reflect the user's intended names, leading to confusion and broken expectations.

**Consequences:** Rust provides a dedicated `rename_item` command that strictly checks vault boundary constraints, prevents directory traversal (`..`, slashes), enforces extension preservation/validation for supported document types, prevents collisions with existing files, and returns the updated relative path. Frontend state migrates cached progress and theme keys smoothly.

The owner later confirmed that both Remove and Rename must leave original files untouched. D-019 replaces this behavior.

## D-016 — Application Launch Landing Pad

**Status:** Accepted

**Decision:** Present a calm, focused landing pad screen when the application launches, featuring the Syllex title and logo, and streamlined vault status before transitioning to the full bookshelf/tree dashboard upon user entry.

**Reason:** Prevents overwhelming the user with the dense library dashboard immediately upon launch. Establishes a focused, deliberate entry into their academic study sanctuary with keyboard shortcut support (`Enter`/`Space`) and quick access to vault management and preferences.

**Alternatives:** Immediately mount the full dashboard or vault explorer upon launch. While fast, it bombards the student with file lists before they are ready to choose their study task.

**Consequences:** The application initializes with `hasEntered = false` displaying `<LandingPad />`. The landing card maintains a decluttered, calm layout focusing on the supplied Syllex wordmark, tagline, vault readiness status, and single-click/keyboard entry. The horizontal wordmark appears in the application header; the square mark remains in native desktop icons. Users enter via the "Enter Syllex" button or keyboard shortcut, and can return to the landing pad at any time via the application header logo.

## D-017 — Local PDF highlight metadata for issue #10

**Status:** Accepted

**Decision:** Deliver the page-preview and highlighting work requested in issue #10 ahead of the later annotation roadmap item. Store highlight geometry, color, and document identity in a versioned SQLite database under the platform application-data directory. Render highlights as viewer overlays; never embed them in the source PDF or converted presentation.

**Reason:** The owner requested issue #10 and confirmed that highlights must survive reopening a document. Application-created study data already belongs in local application data under D-002 and D-003.

**Alternatives:** Session-only highlights would disappear after closing the viewer. Webview localStorage would extend an existing implementation shortcut but would not follow the documented SQLite ownership rule. PDF annotation writes would change original modules and violate D-003.

**Cross-platform impact:** The bundled SQLite library and Tauri application-data path must work on Fedora and Windows 11. The same normalized page geometry is rendered by PDF.js in both webviews.

**Security impact:** Rust validates the selected vault boundary and document path before database operations. The database stores no document bytes or selected text and makes no network requests.

**Consequences:** A versioned migration and native commands are required. Highlights are associated with a canonical module path, so rename handling must migrate that identity. Thumbnails remain disposable viewer renderings, not database content.

D-020 changes the future storage owner of highlights to portable vault data. This entry records the current implementation and remains the rule for view-only overlays.

## D-018 — Supplied Syllex marks and compact page labels

**Status:** Accepted

**Decision:** Use the owner-supplied horizontal Syllex wordmark in the application header and landing pad. Use its light variant directly on dark surfaces and its dark variant on the light landing card. Use the supplied light square mark for the favicon and native desktop icons. Use a sans-serif face for the small page-preview number labels.

**Reason:** The owner supplied light and dark logo variants and requested the horizontal wordmark in both UI locations. The light variant stays legible on dark surfaces without a backing panel or a separate text placeholder.

**Alternatives:** Keep the square mark and separate title in the header, or place the dark wordmark on a light panel. Both retain a placeholder or unwanted light patch. Keeping Georgia on ten-pixel page labels would leave the requested typography unchanged.

**Cross-platform impact:** The same bundled images and CSS display in Fedora WebKitGTK and Windows WebView2. Native icon files are regenerated from the square mark for Linux and Windows packaging. Windows visual validation remains pending on that platform.

**Security impact:** Assets are bundled locally; no network access, storage change, or course-file operation is added.

**Consequences:** The header uses one horizontal image instead of an icon and separate title. The landing pad no longer has a light backing on dark surfaces. The browser uses a root favicon.ico and native application icons use the supplied light square mark. The broader visual identity remains open beyond these supplied marks.

## D-019 — Hide and display-name actions leave modules untouched

**Status:** Accepted

**Decision:** Remove hides a module or folder from the Syllex library, and Rename changes only its display name. Neither action deletes or renames an original file. Hidden items can be restored from the library.

**Reason:** The owner chose this behavior for issue #34. It makes the README, product invariant, and UI actions consistent, and prevents a short undo window from becoming permanent data loss.

**Alternatives:** Permit native file renaming under D-015; allow permanent deletion after confirmation. Both change the user's source-of-truth directory and conflict with the owner's chosen rule.

**Cross-platform impact:** The same SQLite overrides and vault scan filtering work on Fedora and Windows 11. Paths remain device-specific; a live database is never synchronized.

**Security impact:** Rust validates the selected vault and relative item before changing metadata. The native delete and rename commands are removed from the Tauri command surface. No network or source-file write is added.

**Consequences:** A versioned metadata migration stores hidden flags and display names in platform app data. Reading progress and highlights stay attached to the original path because the path does not change. A hidden folder also hides its descendants in the library until restored.

D-020 changes the future storage owner of hidden flags and display names. This entry records the current implementation and remains the rule for metadata-only library actions.

## D-020 — Portable study data in a managed vault directory

**Status:** Accepted

**Decision:** Keep original course modules immutable and store portable, vault-owned flashcards, companion notes, highlights, and library hidden/display-name choices in an identifiable Syllex-managed directory at the vault root. Use `.syllex` when available; if that name belongs to something else, choose a collision-safe alternate and ensure a copied vault can rediscover it. Store notes as individual Markdown files and other study data in versioned portable files. Exclude the managed directory from module scans. Never place a live SQLite database in the vault. Keep selected vault path, last-read page, display preferences, and any live SQLite database in platform app data. Migrate existing highlight and library-override records without loss before switching ownership.

**Evidence and reason:** The owner wants manual vault copies between Fedora and Windows to carry notes, flashcards, highlights, and library organization. The current canonical-path SQLite records in device-local app data cannot do that, and a single root `.syllex` file would make note editing and partial failure recovery harder. The owner explicitly selected a managed folder. Reading position and display preferences were explicitly left per device.

**Alternatives:** Retain all study data in per-device SQLite with explicit export/import; use a second user-selected flashcard folder; or put everything in one monolithic `.syllex` file. These do not meet the agreed copy-the-vault workflow as directly.

**Cross-platform impact:** Portable references must use vault-relative identities rather than source-device absolute paths, with Windows/Fedora case and separator behavior handled explicitly. Manual copying is supported; simultaneous editing or automatic sync is not part of this release.

**Security impact:** Rust must validate the selected vault, managed-directory identity, module references, and writes; refuse collisions and path escapes; use atomic replacement and recoverable errors. Imported or copied portable files remain untrusted. Original modules and external source files are never overwritten.

**Consequences:** M6 first establishes a versioned portable format and migration path. SQLite may still hold device-local state or a rebuildable index, but the vault-owned files are the portable source of truth. Explicit exports under D-010 still go to a user-selected location outside the vault. Full-vault ZIP export is later work.

## D-021 — Independent flashcard decks and session-only review

**Status:** Accepted; supersedes D-009

**Decision:** Put flashcards in a separate tab, with independent decks and plain-text cards users can add, edit, and delete. Each card belongs to one deck and may have one optional plain-text tag, selected from suggested course/module names or typed manually. Tags are not path links and do not change on a module rename. Review a deck or selected tags, optionally shuffled. Known/Unknown labels last only for that session; finish with End, Restart all, or Retake missed. Import/export remain in scope, but import asks for a question/answer separator rather than assuming comma-only CSV; separate cards default to newlines. The multiline-content rule is unresolved and must be decided before parser implementation.

**Evidence and reason:** The owner chose a simple study session over spaced repetition and wants decks separate from the bookshelf while retaining optional module-name organization. Durable ratings, intervals, ease factors, due queues, and course-owned decks would add unwanted complexity.

**Alternatives:** The earlier course-owned CSV decks and spaced-repetition plan; persistent Known/Unknown labels; or a second physical flashcard vault. The owner rejected these for the personal release.

**Cross-platform impact:** Decks and cards travel with manual vault copies through D-020. The same parser, session behavior, and tag matching must be verified on Fedora and Windows.

**Security impact:** Flashcard import files and text are untrusted; preview validation and duplicates before a confirmed write. There is no account, network request, or original-module write.

**Consequences:** M6 needs a card editor, tag-based selection, a session state machine, and portable card storage. Multiple tags and persistent study history are later possibilities, not first-release requirements.

## D-022 — One editable companion note per module

**Status:** Accepted

**Decision:** Create one text-focused Markdown companion note when a module's Notes pane first opens. Store it under D-020's managed directory and show it only from its module, except in an Unlinked Notes recovery view. Default to document and note side by side; allow either pane alone. Edit formatted Markdown directly by default with an explicit raw Markdown mode. Autosave with visible status and safe handling of external edits. Preserve and relink a note if its module disappears. Page links, images, and attachments are later possibilities.

**Evidence and reason:** The owner wants to take notes while reading without seeing raw Markdown during ordinary editing, and wants manual vault copies to include notes. A separate managed directory prevents companion notes from cluttering the course module tree.

**Alternatives:** Read-only `.md` modules, raw-only source editing, notes stored solely in app data, or notes beside each original module. These do not match the chosen workflow.

**Cross-platform impact:** Markdown files and module associations must survive a vault copy between Fedora and Windows, including case/path differences and missing targets. The viewer layout must work in WebKitGTK and WebView2.

**Security impact:** Treat Markdown as untrusted; block active content and unsafe links. Rust scopes writes to app-created notes, uses atomic saves, and detects external-change conflicts without modifying original modules.

**Consequences:** M7 delivers safe Markdown module reading and the companion editor. Page-level anchors and bookmarks are deferred beyond the personal release.

## D-023 — Personal release and automatic library refresh

**Status:** Accepted

**Decision:** The next release targets the owner's Fedora and Windows devices. The library must detect external vault file changes automatically. A changed document that is already open shows a reload notice rather than reloading immediately. Manual Refresh remains available. Full-vault ZIP export, broader search, and additional platforms are later work.

**Evidence and reason:** The owner reports no current reading-workflow blocker but wants external changes reflected without manual refresh. Manual vault copies are sufficient for the first release. Public distribution is not the current release target.

**Alternatives:** Require manual refresh, reload open documents immediately, or complete the full archive/import system before a usable personal release.

**Cross-platform impact:** Watchers and packages must work on Fedora and Windows 11; future platforms require separate decisions.

**Security impact:** Watch only the selected vault, validate event paths before rescanning, never follow events outside the vault, and never write to original modules. A watcher failure must leave manual refresh usable.

**Consequences:** File watching is a personal-release gate in M8. Packaging and manual smoke tests remain required on both desktop targets, without public-release distribution work.



