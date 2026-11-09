# Nox

Web messenger built with Next.js 16, Supabase Auth/PostgreSQL/Storage/Realtime, and LiveKit. Existing user IDs, conversations and message history are preserved by the recovery migration.

## Development

Use Node.js 24+ and Docker for the full local Supabase stack.

```sh
npm ci
npx supabase@3.0.0 start
npx supabase@3.0.0 status -o env > .env.test
cp .env.example .env.local
npm run next:dev
```

Set the public Supabase URL/key in `.env.local` from the **local** stack output. LiveKit is optional for text/file testing; supply its URL and server-only API key/secret to test calls. Never expose a service-role key through `NEXT_PUBLIC_*`. The Supabase config file describes local development only; do not push it over existing production Auth settings.

`npm run dev` also launches the legacy Electron shell. Use `npm run next:dev` for web development. Desktop packaging is not part of this recovery release: the old shell expects a static export that cannot provide the server routes. A later Rust application will use the restored backend contracts; see [the roadmap](docs/RECOVERY_PLAN.md).

## Checks

```sh
npm run lint
npm test
npx tsc --noEmit
npm run build
NOX_TEST_ENV=.env.test node tests/integration.mjs
```

The integration test refuses remote Supabase URLs. It creates isolated `nox_qa_*@example.test` users and verifies simultaneous DM creation, real message delivery, editing, private presence, Storage authorization, profile column permissions, and TOTP AAL1/AAL2 enforcement. It retains synthetic users for browser QA and resets only its synthetic MFA user's factors on repeat runs. Do not run it against a forwarded production endpoint.

For a fast SQL-only check, create an empty disposable PostgreSQL 16+ database whose name ends in `_test`, then run:

```sh
DATABASE_URL=postgresql://localhost/nox_recovery_test npm run test:db
```

`tests/db/platform.sql` supplies minimal platform contracts for those SQL tests. It is never a production migration. Full integration checks use real Supabase services instead.

## Existing production

Read [the release procedure](docs/RELEASE.md). `20261109000000_baseline.sql` is a captured baseline for a **fresh** database; never replay it on the existing project. `20261109010000_recovery.sql` is the transactional recovery change. Keep all data exports and credentials outside Git.
