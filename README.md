# Ansat Platform

[![CI](https://github.com/MHSNMN/ansat-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/MHSNMN/ansat-platform/actions/workflows/ci.yml)
[![Live platform](https://img.shields.io/badge/live-ansatradio.org-1f6f5f)](https://ansatradio.org)

> A full-stack operations platform for **Ansat**, an Arab cultural volunteer initiative that produces accessible audio knowledge.

[Live website](https://ansatradio.org) · Arabic-first · RTL · Role-based · Production-oriented

## Overview

Ansat Platform combines a public cultural website with a secure internal workspace for a distributed volunteer team. It replaces separate member lists and disconnected tools with one identity, one permission model, and three focused operational platforms:

- **Audio Production:** book planning, raw recording uploads, quality review, mastering, final approval, and publishing.
- **Task Management:** assignments, priorities, workflow states, archiving, restoration, and member-scoped views.
- **Rewards and Recognition:** points, peer-to-peer gems, leaderboards, badges, official certificates, and certificate verification.

The public website presents published audio, activities, volunteer applications, and live statistics calculated from real platform data. Administrators manage public content, members, applications, roles, and granular permissions without editing source code.

## Why I Built It

Ansat has volunteers working across narration, audio engineering, linguistic review, events, and administration. The platform needed to solve four connected problems:

1. Give every member one account across all internal tools.
2. Protect sensitive operations with server-enforced permissions.
3. Track audio from raw recording to public release.
4. Keep public content and statistics connected to operational data.

## Architecture

```text
React + TypeScript client
        |
        | HTTPS / JSON / Firebase ID token
        v
Node.js + Express API
        |
        +-- Firebase Auth       Identity and persistent sessions
        +-- Firestore          Trusted roles, permissions, audit, rewards
        +-- Supabase/Postgres  Operational queries and public statistics
        +-- Google Drive       Audio, PDF, and production-stage storage
        +-- Firebase Storage   Covers, avatars, and certificate assets
```

The project is a modular full-stack monolith. Each platform owns its UI, API router, and business rules while sharing authentication, member identities, authorization, and deployment.

## Main Features

### Unified authentication

- Login with email, username, or phone number.
- Persistent Firebase browser sessions.
- One-time migration flow for legacy member PINs.
- Password reset and verified phone authentication flows.
- Server-created custom tokens mapped to a canonical Firebase UID.
- Revoked-token checks and disabled-account enforcement.

### Granular authorization

- Canonical roles with default permissions.
- Independent access decisions for recording, tasks, rewards, and administration.
- Per-action overrides: `INHERIT`, `ALLOW`, and `DENY`.
- Explicit deny takes priority over inherited role access.
- UI route guards for usability and repeated backend checks for security.
- Firestore remains the trusted source for roles and privileges.

### Audio production workflow

```text
RAW_QA_PENDING
  -> RAW_APPROVED or NARRATOR_REVISION_REQUIRED
  -> MASTERING
  -> FINAL_QA_PENDING or ENGINEER_REVISION_REQUIRED
  -> FINAL_APPROVED
  -> PUBLISHED
```

- Permission-controlled workflow transitions.
- Ownership-aware recording access.
- Raw, QA, engineering, final, and PDF storage stages.
- Resumable Google Drive uploads.
- Audio metadata and duration extraction.
- HTTP range streaming for seeking without downloading the complete file.
- Soft archiving to preserve historical records.

### Task operations

- Member and manager task scopes.
- Assignment, priority, status, and due-date management.
- Bulk status changes, archive, and restore.
- Audit-friendly history and authorization checks.
- Shared member directory across all platforms.

### Rewards and certificates

- Atomic Firestore transactions for point and gem operations.
- Idempotency protection against duplicate purchases or grants.
- Daily purchase limits and rest-day rules.
- Transaction reversal for authorized administrators.
- Public leaderboard and member recognition.
- Certificate issue, revoke, print/PDF export, QR code, and public verification.

### Public website and CMS

- Arabic-first responsive RTL interface.
- Public audio library and activity pages.
- Editable content with draft, publish, history, and restore workflows.
- Multiple configurable volunteer application forms.
- Public statistics derived from active members and published recordings.
- Five-minute server cache to reduce database reads.
- Consent-aware display of member names and nationalities.

## Security Design

- Firebase ID tokens are sent as `Authorization: Bearer <token>`.
- The API verifies token validity and revocation before protected operations.
- Sensitive permissions are read from trusted server-side data, not browser storage.
- Firestore and Storage rules default to deny for unspecified paths.
- Sensitive writes pass through authenticated API routes.
- Rate limiting protects login, activation, and password-reset endpoints.
- Password hashes use bcrypt and stay outside public profile documents.
- Public audio access is limited to published, non-archived library records.
- Internal audio requires authentication and the correct permission.
- Administrative changes generate audit records.
- Production credentials are supplied only through environment variables.

No production credentials, private keys, access tokens, refresh tokens, or member data are included in this repository.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Authentication | Firebase Authentication, Firebase Admin SDK |
| Databases | Firestore, Supabase PostgreSQL |
| File storage | Google Drive API, Firebase Storage |
| UI and visualization | Framer Motion, Lucide React, Recharts |
| Documents | jsPDF, html2canvas, QR Code |
| Audio | music-metadata, HTTP range streaming |
| Testing | Vitest, Testing Library |
| Deployment | Render, GitHub Actions |

## API Structure

```text
/api/public/*        Public content, applications, certificate verification
/api/auth/*          Login, session profile, PIN migration, password reset
/api/tasks/*         Task and member operations
/api/recording/*     Books, recordings, reviews, and workflow transitions
/api/rewards/*       Points, gems, leaderboards, community, and admin tools
/api/certificates/*  Certificate administration
/api/admin/*         Members, permissions, CMS, forms, and audit operations
/api/audio/*         Authorized streaming and downloads
/api/health          Service health check
```

## Local Development

### Requirements

- Node.js 20 or newer
- npm
- Firebase project
- Supabase project
- Google Drive OAuth credentials for upload features

### Install and run

```bash
git clone https://github.com/MHSNMN/ansat-platform.git
cd ansat-platform
npm ci
cp .env.example .env
npm run dev
```

On Windows PowerShell, use `npm.cmd` if PowerShell blocks `npm.ps1`:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open `http://localhost:3000`.

### Environment variables

Only names are documented here. Never commit real values.

```dotenv
# Firebase Admin: server only
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_DATABASE_ID=
FIREBASE_STORAGE_BUCKET=

# Supabase: server only
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Google Drive: server only
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_DRIVE_ROOT_FOLDER_ID=

# Public client configuration
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Verification

The repository currently passes 171 automated tests across 27 test files, along
with type checking, linting, formatting, and the production build.

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Production build creates the Vite client bundle. The Express application is started
directly from its TypeScript entry point so server source maps and server internals are
never placed inside the public `dist/` directory. Run it with:

```bash
npm start
```

## Engineering Highlights

This project demonstrates practical experience with:

- Full-stack TypeScript development.
- Authentication and persistent session design.
- Role-based and attribute-aware authorization.
- REST API design and middleware composition.
- Multi-database integration and data synchronization.
- Transactional reward systems and idempotent operations.
- Secure file upload and streaming workflows.
- Arabic RTL product design.
- Public CMS and operational admin tooling.
- Automated tests, production builds, and cloud deployment.

## Project Status

The platform is actively developed and deployed. External integrations require the repository owner's Firebase, Supabase, Google Drive, and hosting configuration. Demo data and production member records are intentionally excluded.

## Author

Built by [Mohsen Mohammed Ali](https://github.com/MHSNMN) as a real operational
platform for **Ansat Initiative**.

For recruitment review, architecture discussion, or a guided demo, use the
[developer portfolio](https://mhsnmn.github.io/developer-portfolio/) or contact
the repository owner through GitHub.
