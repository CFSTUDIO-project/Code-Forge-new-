# CODEFORGE

**Forge your vision. Connect and code.**

CODEFORGE is an open-source, mobile-ready development workbench. This repository contains the first runnable foundation for the Web app and the Android APK build pipeline.

> This is an early v0.1.0 foundation, not a finished VS Code replacement. The editor, local workspace, sandboxed web preview, browser JavaScript runner, Pyodide Python runner, guest mode, Supabase email/password auth, Supabase cloud workspace sync and GitHub Actions build workflows have working implementations. Some integrations are intentionally marked as setup-required or not bundled yet; see [Feature status](#feature-status).

## Design direction

The workbench follows the supplied CODEFORGE visual references: dark professional workbench, left activity/explorer, tabbed code editor, right Git/Inspector rail, integrated bottom terminal/problems/output/debug panel, centered sign-in screen, and compact grouped profile menu. It uses its own visual system and does not copy VS Code branding or source code.

The CF + hammer mark is provided as SVG, web favicon, PWA icons and Android launcher PNG resources. The Android workflow generates the Capacitor project, applies the launcher icon set and forces landscape orientation.

## Requirements

- Node.js 22+
- npm 10+
- Android Studio is optional for local Android builds; GitHub Actions can build the debug APK in the cloud.
- A modern Chromium-based browser is recommended for the first Web/PWA experience.

## Run the Web app

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the local URL printed by Vite. The app also runs without cloud credentials in **Guest Mode**. Guest workspaces are stored in IndexedDB on the current device. Logging out clears the local workspace after a confirmation.

To create a production web build:

```bash
npm run build
npm run preview
```

## Build Android APK

The Capacitor Android project is generated from the same Web app, so Web and APK share the same application UI and features.

```bash
npm install
npm run build
npx cap add android
npx cap sync android
npm run android:prepare
```

Then open `android/` in Android Studio and build a debug APK, or run:

```bash
cd android
./gradlew assembleDebug
```

The `android:prepare` step sets the launcher activity to landscape and copies the CF + hammer launcher icons. The APK build is also automated by `.github/workflows/ci.yml` and uploads `codeforge-android-debug-apk` as a workflow artifact.

**Mobile note:** The Android app opens in landscape by design. The Web app remains responsive and can be used in portrait or landscape. The extra coding-key strip is shown on narrower screens and offers working editor insertion/navigation shortcuts (CTRL+S, CTRL+F, Tab, Enter, brackets, punctuation and cursor movement). A physical/Bluetooth keyboard continues to use Monaco's regular keyboard handling.

## Supabase setup (authentication + workspace cloud)

Supabase is the source of truth for user identity and cloud project data in this starter. Firebase is not a second identity provider in the same session, avoiding duplicate accounts and login-state conflicts.

1. Create a Supabase project on the Free plan.
2. In **Project Settings → API**, copy the Project URL and the publishable key (or legacy `anon` key).
3. Copy `.env.example` to `.env.local` and set:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

4. In **Authentication → URL Configuration**, add your Web app origin to the Site URL and Redirect URLs. For local development add `http://localhost:5173/`.
5. In **Authentication → Providers**, enable email/password. For Google/GitHub OAuth on the Web, configure each provider's OAuth credentials and callback URI from the Supabase provider screen. Add the deployed Web URL to the provider's allowed redirect list.
6. Open **SQL Editor** and run the migration file `supabase/migrations/202611200001_initial_schema.sql`.
7. Restart Vite after changing `.env.local`.

The migration creates `projects` and `project_files`, enables Row Level Security, revokes broad client grants, and grants only authenticated CRUD operations guarded by user ownership. A Supabase secret/service-role key is never used in the client. The browser-safe publishable/anon key is expected to be public; database security comes from RLS and grants.

When an authenticated user edits files, CODEFORGE debounces an upsert into Supabase. On sign-in it restores the signed-in user's cloud workspace. If cloud sync fails, local IndexedDB content remains available and the status bar reports an error. Guest mode never uploads projects automatically.

### OAuth on Android

Email/password sign-in is the supported auth method for the generated APK in this starter. Web OAuth is implemented for GitHub and Google when configured in Supabase. Native OAuth needs a verified custom-scheme App Link / deep-link callback and provider redirect allow-list; it is deliberately not presented as working in the APK until that native callback path has been configured and tested. The app displays a clear explanation instead of starting a redirect that could strand the user at the login screen.

## Firebase setup (optional notifications foundation)

Firebase is an optional companion service, not a duplicate database or auth system in this architecture. The app can initialize a Firebase Web App when credentials are supplied, while Supabase continues to own authentication and cloud workspace records.

1. Create a Firebase project and register a Web app.
2. Copy the Web app's public config values into `.env.local`:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_VAPID_KEY=
```

3. For Web Push, enable Firebase Cloud Messaging, create a Web Push certificate (VAPID key), serve the app over HTTPS, and configure a service worker plus a trusted sender environment. The FCM server/Admin credential must stay server-side and must never be embedded in the Web app or APK.

The current starter initializes the Firebase app configuration only. Device-token registration, background-message UX and a trusted notification sender are a separate integration milestone, not claimed as complete in v0.1.0. Firebase Analytics and Crashlytics are also not enabled by default.

## GitHub and Workflows

1. Create a repository and push this project to its `main` branch.
2. GitHub Actions runs the Web build and Android debug APK build on push, pull request, and manual dispatch.
3. Open **Actions → CODEFORGE CI**. Download `codeforge-web-dist` or `codeforge-android-debug-apk` from the completed run's Artifacts section.
4. The separate `Deploy CODEFORGE Web to GitHub Pages` workflow can publish the Web build. Enable GitHub Pages with **GitHub Actions** as the build source in repository Settings.

The Workflows view reads and edits local `.github/workflows/*.yml` files. Live Actions run history and run/cancel controls are not connected to the GitHub REST API yet; the app points users to repository Actions until OAuth/repository scopes are configured.

### Build configuration in GitHub (recommended for Web + APK)

In the repository, open **Settings → Secrets and variables → Actions → Variables** and add the following repository variables. These are browser-delivered public client configuration values, not private server credentials:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (or Supabase publishable key)
- Optional Firebase Web config: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_VAPID_KEY`

Both CI workflows read these variables when building. Never add OAuth client secrets, Firebase Admin/service-account JSON, Supabase `service_role`/secret keys, personal access tokens, or Android signing private keys to these variables or to frontend code. OAuth provider secrets belong in the Supabase provider configuration.

### Uploading the source from an Android phone

1. Create an empty repository on GitHub (do not initialize it with a README or license, because this ZIP already includes them).
2. Extract the ZIP on the phone. With Termux, the commands are:

   ```bash
   pkg install unzip git nodejs-lts -y
   termux-setup-storage
   mkdir -p ~/projects && cd ~/projects
   unzip ~/storage/downloads/CODEFORGE-v0.1.0.zip
   cd CODEFORGE
   git init -b main
   git add .
   git commit -m "Initial CODEFORGE v0.1.0"
   git remote add origin https://github.com/USERNAME/REPOSITORY.git
   git push -u origin main
   ```

   Replace `USERNAME/REPOSITORY` with the repository you created. GitHub may ask you to authenticate; use GitHub's supported sign-in/token flow, and never paste a token into a public chat or commit it into the project.
3. In the repository, open **Actions** and check **CODEFORGE CI**. On the first run, GitHub may require enabling Actions. When the run completes, download `codeforge-android-debug-apk` to get the debug APK and `codeforge-web-dist` for the web build.
4. To publish the web version, open **Settings → Pages**, select **GitHub Actions** as the source, then run **Deploy CODEFORGE Web to GitHub Pages** from Actions.

The first GitHub Actions build downloads Android and npm dependencies and may take several minutes. Build artifacts expire after 14 days in this workflow; they are not permanent releases.

## Runtime and terminal model

The bottom panel is a **workspace terminal**, not a full OS shell. It currently supports `help`, `pwd`, `ls`, `cat`, `echo`, `touch`, `mkdir`, `clear`, `python <file.py>`, `js <file.js>` and `preview`.

- Python uses the pinned Pyodide WebAssembly distribution in a dedicated Worker, so Python execution does not block the UI thread. It needs an internet connection on first load to download the pinned runtime and package files. It is CPython compiled for WebAssembly, not the host device's native CPython; packages requiring unsupported native/system capabilities may not work.
- JavaScript source files run in a disposable Web Worker without DOM access and with a five-second execution limit. This is a browser JavaScript runtime, not Node.js.
- HTML/CSS/JS is rendered by a sandboxed iframe. The frame does not receive `allow-same-origin`; preview code therefore runs separately from the IDE origin. Preview console output is bridged to the terminal.
- C, C++, Rust, Java, Kotlin, Go, PHP, C#, SQL and Lua have file icons and editor language IDs where Monaco provides them, but their compilers/interpreters are **not bundled** in this release. The Run action tells the user when a native runtime is missing instead of pretending to execute the code.

## Feature status

| Area | v0.1.0 status |
|---|---|
| Web app + responsive workbench | Implemented |
| Android Capacitor project generation | Implemented through Actions/local commands |
| CF + hammer SVG, favicon and launcher PNG resources | Implemented |
| Landscape Android orientation | Applied by Android preparation script |
| Login / sign-up / password reset via Supabase email | Implemented when configured |
| GitHub / Google Web OAuth | Implemented when Supabase providers are configured |
| OAuth inside generated APK | Requires native deep-link callback configuration |
| Guest mode and warning | Implemented; local-only |
| Monaco editor / syntax IDs / JS completion snippets | Implemented; language intelligence varies by language |
| IndexedDB workspace persistence | Implemented |
| Supabase project/file sync + RLS migration | Implemented when configured and migration applied |
| Python execution | Implemented through Pyodide Worker; WebAssembly limitations apply |
| Browser JavaScript execution | Implemented in disposable Worker; not Node.js |
| HTML/CSS/JS Live Preview | Implemented in sandboxed iframe |
| GitHub Actions build workflows | Included; needs repository push and Actions enabled |
| Git operations and live GitHub Actions controls | UI preparation only; API integration remains |
| Extension Marketplace | Local catalog/enable state only; signed package distribution and sandbox host remain |
| Firebase | Web app initialization only; FCM device registration/sending remains |
| Native runtimes for C/C++/Rust/Java/Kotlin/Go/PHP/C# | Not bundled yet |
| LSP/debug adapters for every language | Not bundled; support varies by language |

## Security notes

- Never commit `.env.local`, OAuth client secrets, Firebase Admin credentials, Supabase service-role/secret keys, GitHub PATs or private signing keys.
- The Supabase publishable/anon key can be in the client only because it is paired with strict grants and RLS; test the policies before using real user data.
- The Python and JavaScript browser workers isolate execution from the editor UI, but they are not a replacement for a hardened server-side multi-tenant sandbox. Do not use this starter to execute untrusted code from strangers.
- Marketplace entries in this release are local examples. No arbitrary third-party code is downloaded or executed.
- Free tiers have quotas and terms that can change. Configure usage alerts and do not add billing unless the owner explicitly chooses to.

## Repository structure

```text
CODEFORGE/
├── .github/workflows/       # Web + Android CI, Pages deployment
├── assets/                  # Source icon + Android density icon resources
├── docs/                    # Architecture, security and feature plan
├── public/                  # Favicon, PWA assets, runtime workers
├── scripts/                 # Android manifest/icon preparation
├── src/
│   ├── lib/                 # Auth clients, cloud sync, storage, languages
│   ├── styles/              # Responsive IDE theme
│   ├── App.tsx              # Workbench and login experience
│   └── main.tsx
└── supabase/migrations/     # SQL schema and RLS policies
```

## License

MIT. See [LICENSE](./LICENSE).
