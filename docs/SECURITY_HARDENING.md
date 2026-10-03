# Security hardening summary

This release was reviewed across authentication, authorization, storage, database,
upload, public API, browser, and build boundaries.

## Controls added

- Server-side RBAC guards for administrative, content, country, task, recording, and
  rewards operations. Client-side visibility is not treated as authorization.
- Role hierarchy and exact role allowlists prevent self-promotion and changes to peers
  or higher-privileged accounts.
- Legacy PIN activation is bound to the stored invitation identity and cannot be used
  to attach an arbitrary email address.
- Firebase sessions are revoked and token versions are advanced after security-sensitive
  account changes.
- Firebase Storage rules scope audio objects to their owner, validate content type and
  size, and deny unknown browser writes.
- Supabase application tables have an idempotent migration that enables and forces RLS,
  removes direct browser privileges, and preserves server-only service-role access.
- Public audio streaming only serves files referenced by published, non-archived library
  records and validates byte-range requests.
- Security headers include a restrictive CSP and same-origin framing policy.
- Login redirects are restricted to known same-origin application routes.
- Internal provider errors are not returned to clients in 5xx responses.
- Server code and source maps are kept outside the public client build directory.
- Dependency audit, type checking, linting, formatting, automated tests, and production
  build are required release checks.

## Deployment responsibilities

- Apply `supabase/migrations/20261003000000_harden_application_table_access.sql` to the
  production Supabase project before enabling production traffic.
- Deploy `firestore.rules` and `storage.rules` to the intended Firebase project and test
  them with the Firebase Emulator Suite.
- Store all service credentials only in the deployment platform's secret manager. Never
  commit `.env`, service-account JSON, refresh tokens, or service-role keys.
- Rotate any credential that has previously appeared in a chat, log, screenshot, or
  repository history.
- Run the release verification commands documented in the root README after every
  security-sensitive change.

No security review can guarantee the absence of every future vulnerability. These
controls reduce the known attack surface and make the remaining cloud-side verification
steps explicit.
