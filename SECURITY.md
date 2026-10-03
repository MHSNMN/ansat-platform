# Security Policy

## Reporting a vulnerability

Please do not publish exploitable details in a public issue. Send a private report to the project owner with:

- the affected route or component;
- reproducible steps;
- the expected and observed behavior;
- the potential impact;
- a suggested remediation, if available.

Do not access, alter, or download data that does not belong to you while testing.

## Security boundaries

- Firebase Authentication establishes identity.
- The Express API verifies revoked ID tokens and loads current roles and permissions from trusted server-side data.
- Administrative and state-changing operations are authorized on the server; client route guards are usability controls only.
- Supabase service-role credentials, Firebase Admin credentials, and Google OAuth secrets are server-only environment variables.
- Firestore, Firebase Storage, and Supabase Row Level Security default to deny for direct untrusted writes.

## Secret handling

Never commit `.env`, service-account JSON, private keys, refresh tokens, or service-role keys. Use `.env.example` only as a field-name template. If a secret is exposed, revoke and rotate it before removing it from Git history.

## Supported version

Security fixes are applied to the latest version on the default branch.
