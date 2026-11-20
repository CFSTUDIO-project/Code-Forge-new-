# Contributing to CODEFORGE

Thanks for considering a contribution.

1. Fork the repository and create a focused feature branch.
2. Keep features modular and typed. Avoid turning `App.tsx` into a place for unrelated services as the project grows.
3. Do not add secrets, service-role keys, OAuth client secrets or personal project data.
4. Add tests for authentication, sync, data access and runtime behavior when changing those paths.
5. Run `npm install` and `npm run build` before opening a pull request.
6. Describe platform differences and known limitations. Never mark an integration complete if it is only a UI placeholder.

For security-sensitive issues, do not publish exploit details in a public issue. Contact the maintainers privately after the repository has a security contact configured.
