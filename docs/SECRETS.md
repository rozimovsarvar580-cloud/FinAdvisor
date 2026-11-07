---
noteId: "5dd50171da9c11f19fcb3b18069fac28"
tags: []

---

# Secret handling and rotation

This document describes where the current application consumes the listed secrets and how operators
should rotate them. It contains no secret values. Store production credentials in the deployment
platform's secret manager; do not put real values in source control, tickets, logs, browser-visible
configuration, or desktop builds.

## Secret boundaries

| Secret | Consumer | Purpose |
|---|---|---|
| `JWT_SECRET` | API; web middleware only as a legacy NextAuth fallback | Signs and verifies API bearer tokens. |
| `NEXTAUTH_SECRET` | Web server and middleware | Protects NextAuth JWT session cookies. Configure it independently from `JWT_SECRET`; the current web code falls back to `JWT_SECRET` if it is absent. |
| `INTERNAL_API_KEY` | Web server and API | Authenticates the server-to-server OAuth exchange using the `X-Internal-Key` header. The API rejects the request if the key is missing or does not match. |
| AI provider key | API only | Read by the API from `apps/api/ai.config.json`; `OPENAI_API_KEY` is the fallback when that file is absent. A present config file takes precedence over the environment fallback. |

`apps/web/src/lib/auth.ts` and `apps/web/src/middleware.ts` read secrets only in server-side
authentication code. Client components import only the `UserRole` type from the auth module, which is
erased at build time. The web client may receive public configuration such as `NEXT_PUBLIC_API_URL`
and the public Sentry DSN; never place a credential in a `NEXT_PUBLIC_*` variable.

The desktop UI bundle contains no API, NextAuth, internal-service, or AI provider credentials and does
not call the AI provider directly. The desktop runtime's optional `SENTRY_DSN` is an error-reporting
endpoint, not an authentication credential.

The legacy `/api/v1/auth/login` route previously accepted a committed demo password and issued a
static token. That shortcut is disabled; the legacy route rejects login until it is migrated to a real
authentication flow. Tests that need legacy sessions create them directly in the test database.

## Rotation

Use the deployment secret manager to generate and distribute new values. The code has no overlapping
key/key-ring support for these credentials, so coordinate rotations and expect a brief interruption
for OAuth exchange while `INTERNAL_API_KEY` consumers are updated. Do not print secret values while
verifying a deployment.

1. **`JWT_SECRET`** — update the API value and restart API instances together. Existing access tokens
   signed with the previous value stop validating. If `NEXTAUTH_SECRET` is not set, the web currently
   shares this key for NextAuth and its sessions will also be affected; set a separate `NEXTAUTH_SECRET`
   before rotating.
2. **`NEXTAUTH_SECRET`** — update the web deployment and restart it. Existing NextAuth session cookies
   become invalid and users may need to sign in again.
3. **`INTERNAL_API_KEY`** — update the API and web deployment as one coordinated change, then restart
   both. Verify the OAuth exchange succeeds after both sides use the new key; the API does not accept
   two keys concurrently.
4. **AI provider key** — update the API's secret-managed `ai.config.json` mount, or update
   `OPENAI_API_KEY` when no config file is mounted. Restart the API, verify a controlled AI request,
   then revoke the former provider key. Never send this key to the web or desktop.

After each rotation, check authentication, OAuth exchange, and the affected service without exposing
environment values in logs. Revoke the old credential after successful cutover. If compromise is
suspected, revoke it immediately, rotate all affected consumers, review access logs, and invalidate
sessions or tokens as appropriate.

## Local development and CI

Use `.env.example` only as a placeholder template. `.env` and `apps/api/ai.config.json` are ignored by
Git; verify that real deployment values remain in the secret manager and not in tracked files.
GitHub Actions credentials belong in repository or environment secrets, not workflow literals.
