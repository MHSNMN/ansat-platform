# Ansat verification snapshot

Date: 15 October 2026, Asia/Baghdad.

Source revision: [`f7c3fcc00ff9e0861e5ed5d4708e8f582d51915d`](https://github.com/MHSNMN/ansat-platform/commit/f7c3fcc00ff9e0861e5ed5d4708e8f582d51915d).

The following commands were run against that source revision with the locally installed dependencies:

| Command | Result |
| --- | --- |
| `npm test` | Passed: 171 tests across 27 test files; exit code 0 |
| `npm run typecheck` | Passed; exit code 0 |
| `npm run lint` | Passed; exit code 0 |
| `npm run format:check` | Passed for the configured source-file patterns; exit code 0 |
| `npm run build` | Passed; exit code 0 |

These checks apply to **Ansat Platform**, not the separate developer portfolio website.

## Scope

The test suite exercises application behavior with test fixtures and mocked services where configured. A passing production build confirms that a bundle was generated. It does not validate live Firebase, Supabase, or Google Drive configuration, production member data, or every deployment environment.

The local check used Windows, Node.js 24.11.0, and npm 11.6.1, and reused installed dependencies; a clean dependency installation was not repeated. The CI workflow separately targets Node.js 22. No dependency audit or penetration test is claimed by this snapshot. A passing test count does not establish complete coverage or guarantee security.

For later revisions, inspect the [CI workflow runs](https://github.com/MHSNMN/ansat-platform/actions/workflows/ci.yml) or repeat the documented commands. The source revision above identifies the application code checked before this documentation update.
