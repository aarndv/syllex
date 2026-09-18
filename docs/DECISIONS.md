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

**Status:** Accepted

**Decision:** Implement accessible structural UI without establishing a visual theme or broader visual identity.

**Reason:** The product name, Syllex, is established, but the owner has not selected a visual direction.

**Consequences:** Agents must avoid premature palette, icon, logo, and other visual identity decisions.

## D-006 — Single-device development

**Status:** Accepted

**Decision:** All source development occurs on the Fedora KDE laptop. Windows 11 remains a supported runtime and validation target.

**Reason:** A single development machine avoids toolchain drift, unfinished-work handoffs, and working-tree conflicts while keeping the workflow simple.

**Consequences:** Fedora hosts the development toolchain and local checks. Windows builds are produced by native CI runners and periodically installed on the Windows 11 PC for manual platform testing. The Windows PC does not need a development checkout or compiler toolchain unless this decision changes later.

## New decision template

```md
## D-NNN — Title

**Status:** Proposed | Accepted | Superseded

**Decision:** What is being decided?

**Reason:** Why is this choice appropriate?

**Alternatives:** What credible alternatives were considered?

**Consequences:** What becomes easier, harder, or constrained?
```
