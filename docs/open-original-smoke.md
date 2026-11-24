# Open Original package smoke test

Run these steps in packaged Syllex builds on Fedora and Windows 11.

1. Select a vault containing a PDF, PPT, PPTX, and Markdown module. Open each module, then select **Open Original**. Confirm the default system application opens the original file.
2. Remove LibreOffice or make it unavailable, then reopen a presentation. Confirm the preview error still shows **Open Original** and the action opens the presentation. Confirm PDF reading, notes, and flashcards still work.
3. Rename or move a module outside Syllex, then select **Open Original** from its stale reader. Confirm a useful missing-file error appears.
4. Configure a file type with no working default application and select **Open Original**. Confirm an opener error appears. Restore the association afterward.
5. Compare file hashes before and after the actions. The source files must remain unchanged.

The Rust path validation tests cover traversal, stale paths, unsupported files, and a symlink escaping the vault. Package smoke tests still require both desktop platforms.
