# CODEFORGE Architecture

## Product shape

CODEFORGE is one workbench with two delivery targets: a responsive Web app and an Android app packaged with Capacitor. The Web app is the primary shared UI; native Android capabilities can be added behind platform adapters without duplicating the editor.

## Responsibility boundaries

- **GitHub:** source repository, issues, pull requests, GitHub Actions CI, releases and downloadable build artifacts.
- **Supabase:** single identity provider (email/password and configured Web OAuth), Postgres metadata, project file records, Row Level Security and cloud workspace synchronization.
- **Firebase:** optional companion services. The v0.1.0 app initializes a Firebase Web app configuration; FCM registration/sender and Crashlytics are future integration work. Do not duplicate authentication or project database records across Firebase and Supabase.
- **IndexedDB:** local project workspace and offline edits.
- **Monaco:** text editor, syntax tokens, built-in language workers and editor completion providers.
- **Pyodide Worker:** browser Python WebAssembly runtime.
- **JavaScript Worker:** browser-side JavaScript file execution, explicitly not Node.js.
- **Sandboxed iframe:** HTML/CSS/JS preview.
- **Capacitor:** Android WebView packaging and native bridge boundary.

## Authentication lifecycle

1. Create one Supabase client with persisted sessions and PKCE flow.
2. Subscribe to `onAuthStateChange` once at the application root.
3. Restore the persisted session with `getSession`.
4. Render the sign-in view only when there is neither an authenticated user nor a current guest session.
5. On sign-out, call Supabase sign-out and clear local guest workspace only after user confirmation.
6. OAuth callback routing remains on the same app entry point. Web OAuth is enabled when the configured provider and redirect allow-list are correct. Native OAuth requires a tested deep-link exchange implementation before being enabled.

This avoids a protected-route redirect loop caused by multiple independent auth state stores.

## Workspace lifecycle

- `WorkspaceFile` is the common file model (`id`, `name`, `path`, `content`).
- IndexedDB saves the current workspace locally.
- Authenticated workspaces sync to `projects` and `project_files` through Supabase.
- Supabase RLS uses `auth.uid()` and checks ownership on every row.
- Guest data is local-only; sign-out clears it after an explicit confirmation.

## Runtime contract

An editor language ID is not a runtime. Runtime support must be represented separately with explicit compatibility notes. Initial runtime support:

| Language / document | Runtime | Environment |
|---|---|---|
| Python | Pyodide | WebAssembly Worker |
| JavaScript | Browser Worker | Browser JS, not Node |
| HTML/CSS/JS | Sandboxed iframe | Browser preview |
| Other language IDs | None bundled | Highlighting/editor only |

A future runtime registry should define executable, version, target platform, package system, file I/O, stdin/stdout, cancellation, resource limit, and sandbox boundary for each language.

## Extension model

The v0.1.0 catalog is presentation/local state only. A real marketplace requires a versioned manifest schema, cryptographic package verification, publisher identity, permission prompts, compatibility checks, sandboxed extension host, rollback and abuse reporting before package installation can be enabled.
