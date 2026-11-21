# CODEFORGE V2 — Feature Status

This file describes what exists in the V2 browser build. It deliberately separates features that run in this application from integrations that require a real operating-system runtime, external credentials, or a separate service.

## V2 — implemented in this source tree

- Responsive browser workbench with Explorer, Search, Source Control status, Run & Debug, Workflows, Tool Catalog, Inspector, Command Palette and Settings.
- Monaco editor with syntax IDs, inline completion snippets, minimap, word wrap, adjustable font size and editor formatting action where a formatter is available.
- File naming dialog with live file-type/language recognition. Icons update after a recognized complete extension is entered; unknown extensions such as `.p` stay generic rather than being guessed as Python.
- File-name associations for common web, programming, configuration, data, mobile and infrastructure files, including special names such as `Dockerfile`, `package.json`, `.gitignore` and `.env.*`.
- Split editor with two editable panes and file selection for the second pane.
- File navigation history with Back and Forward controls.
- Integrated **workspace terminal** with virtual working directory and `help`, `pwd`, `ls`, `tree`, `cd`, `cat`, `head`, `tail`, `grep`, `wc`, `echo`, `touch`, `mkdir`, `rm`, `mv`, `open`, `python`, `js`, `preview` and `clear` commands. It supports command history, starting a clean workspace session, clearing output and stopping active workers.
- Python execution through Pyodide/WebAssembly in a Worker; JavaScript execution in a disposable Worker with a five-second limit; HTML/CSS/JS preview in a sandboxed iframe.
- Import from ZIP, CODEFORGE JSON backup and individual text files. ZIP imports accept stored/deflate entries, validate archive paths, skip binary/unsupported entries and enforce per-file and total expanded-size limits. GitHub source ZIP root folders are normalized.
- Export workspace as ZIP or portable `.codeforge.json` backup.
- Merge or replace import flow, IndexedDB local persistence, Supabase account/cloud-sync integration when configured.
- Mobile coding-key strip with a dedicated Terminal launcher; Terminal panel defaults open on a fresh install and remembers the user's last visibility preference.
- Persisted preferences for font size, word wrap, minimap, local auto-save and Terminal visibility.

## Integration boundaries — not represented as finished

These require capabilities not shipped by a browser-only workspace or cannot safely be enabled without provider setup:

- **Native shell / system terminal:** the workspace terminal manipulates CODEFORGE's in-memory file model. It is not Bash, Zsh, PowerShell, Termux or the device's filesystem. OS commands, package managers and compilers are not available.
- **Git clone / commit / push / pull / branches:** the current UI reports that no Git provider is connected. Use ZIP import/export for source transfer. Real Git operations require an authenticated Git provider integration and carefully scoped repository permissions.
- **GitHub Actions live runs / cancel / logs / artifacts:** YAML files in `.github/workflows` can be opened and edited. Dispatching or cancelling workflows and reading private logs require GitHub Actions authorization. No mock branch graph or fake commit status is displayed.
- **Native APK OAuth:** deep-link callback and provider allow-list configuration must be installed and tested for Android before it can be declared supported.
- **FCM notifications:** Firebase Web configuration alone is not a notification system. Device registration and a trusted server-side sender are required.
- **C/C++/Rust/Java/Kotlin/Go/PHP/C#/SQL/Lua execution, LSP, breakpoints and full debugging:** file editing and language identification do not mean a compiler, interpreter, language server or debugger is bundled.
- **Executable third-party extensions:** the Tool Catalog stores local selections only. It does not download or run arbitrary extension packages. A signed package format, permission model and isolated extension host are required first.
- **Binary project assets:** this workspace model stores UTF-8 text files. Binary image/font/media files are reported as skipped during import and are not included in text-source exports.

## Reference principles from VS Code research

- Terminal UX should distinguish an actual shell session from editor/workspace commands. VS Code's integrated terminal launches a shell installed on the host operating system; CODEFORGE's browser terminal therefore labels its limited virtual command environment explicitly.
- File-type icons should be associated with full filenames and extensions rather than guessing from a partial suffix. The V2 file recognizer follows this model and changes the preview as the completed extension becomes known.
- An extension marketplace needs more than an install button: a real extension platform needs declared contributions/capabilities and a lifecycle. The local catalog is labelled honestly until the signed package and sandbox systems exist.

References: [VS Code Terminal Basics](https://code.visualstudio.com/docs/terminal/basics), [VS Code File Icon Theme API](https://code.visualstudio.com/api/extension-guides/file-icon-theme), [VS Code Extension Capabilities](https://code.visualstudio.com/api/extension-capabilities/overview).
