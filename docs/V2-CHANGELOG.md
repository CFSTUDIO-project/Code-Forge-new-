# CODEFORGE V2 — Changelog

## Workspace and editing
- Added a dedicated New File dialog with live filename recognition and path-based file creation.
- Added more file extensions and special filename associations, with distinct file marks in Explorer, tabs, split panes and Inspector.
- Added a real split editor with a selectable secondary file.
- Added Back and Forward file navigation.
- Added formatter command invocation when the active Monaco language provides a formatter.
- Persisted editor font size, word wrap, minimap, automatic local save and Terminal visibility.

## Terminal
- Fixed the bottom panel's CSS Grid sizing. The panel now occupies its assigned grid row instead of forcing `height: 100%` and being clipped.
- Terminal opens by default on a fresh install and has a visible dedicated launcher in the mobile coding-key strip.
- Added virtual working directory navigation, command history, file operations, text search, line/word/byte counts, and Python/JavaScript runner commands.
- Added Stop Execution, New Session and Clear controls.
- Kept the browser sandbox boundary explicit: this is not a device shell or Node.js environment.

## Project transfer
- Added ZIP export and import, portable CODEFORGE JSON backups, and single text-file import.
- Added merge-or-replace import choice, ZIP path traversal filtering, binary-entry skipping and size limits.
- Added normalization for GitHub source ZIP archives.

## UI accuracy
- Removed the decorative sample Git branch graph and false all-files-modified markers.
- Source Control now displays the real disconnected state and local workspace files.
- Tool Catalog and GitHub Actions surfaces explicitly describe their present capability boundaries instead of claiming that remote package installs or workflow runs are active.
