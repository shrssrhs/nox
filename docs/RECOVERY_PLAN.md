# Nox recovery roadmap

## Web recovery

Preserve existing accounts, IDs and message history. Keep Next.js, Supabase and LiveKit, and restore the current web messenger through reviewed migrations and compatible client releases.

1. Back up application/Auth rows and Storage objects; verify application restore and file hashes in isolation.
2. Version the schema, add transactional channel/DM creation and enforce membership, sender identity, private profile columns and MFA through RLS and restricted grants.
3. Repair subscription ownership and React lifecycle errors. Use private Realtime topics, refresh after actual CDC registration, and reconcile history after reconnects.
4. Preserve drafts and failed-send state. Acknowledge persisted messages before clearing input; reuse retry identities, support keyset history pagination and keep conversations isolated during switches.
5. Read old/new attachments through short-lived signed URLs, restrict uploads to a conversation/member path, and preserve legacy objects for review.
6. Check login, onboarding, search/new DM, channels, editing/deletion, files, presence, calls, mobile layout and service failures. Run lint, type, SQL, real Supabase integration and production build checks before release.
7. Release the compatible web client, apply the recovery transaction, verify preserved data and access boundaries, and record the deployed versions.

## After the first stable release

- Resolve legacy login/public-alias inconsistencies through an explicit identity migration.
- Persist read cursors, add attachment lifecycle metadata/cleanup, improve reaction foreign keys, and split the large layout into focused components.
- Add operational monitoring, tested scheduled backups and measurable recovery targets.

## Later: Rust application

Build a Rust application after the web messenger and its backend contracts are stable. Reuse Supabase Auth, membership rules, messaging/Storage APIs and LiveKit authorization. Decide between a native UI and a Rust desktop shell in a separate design step. Test secure session storage, notifications, files, reconnects and platform packaging. Keep backend service-role secrets out of every client.
