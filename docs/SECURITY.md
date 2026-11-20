# Security model and release checklist

## Must remain true

- Supabase secret/service-role keys and Firebase Admin service accounts are server-only.
- Client data access is protected with explicit Postgres grants and RLS.
- Do not trust `user_metadata` as an authorization source.
- Preview runs in a sandboxed iframe without `allow-same-origin`.
- Browser code execution is not an isolation boundary for hostile multi-user code; do not expose it as a public execution service.
- Marketplace package execution is disabled until a signed, permissioned, isolated extension host exists.
- OAuth redirect URLs must match exact allowed origins and native deep-link routes must be verified before enabling native OAuth.
- Do not store GitHub access tokens in IndexedDB, localStorage, logs, or workspace files.

## Before public beta

- Add automated tests for auth restore, expired/refresh sessions, user switching, logout and OAuth callback paths.
- Add `supabase test db` tests for allow/deny cases on all RLS policies.
- Add dependency and secret scanning to CI.
- Add CSP and Trusted Types review for preview, Monaco, worker and CDN policies.
- Add cancellation/resource controls for all runtime workers.
- Add backup/export and quota reporting for cloud workspaces.
- Verify Google Play requirements and Android permission prompts before publishing APKs.
