#!/usr/bin/env bash
set -euo pipefail
# A disposable database is required. Never point this at Supabase production.
: "${DATABASE_URL:?Set DATABASE_URL to a disposable PostgreSQL database ending in _test}"
case "${DATABASE_URL%%\?*}" in
  */*_test) ;;
  *) echo 'Refusing to run: database name must end in _test' >&2; exit 1 ;;
esac
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/db/platform.sql \
  -f supabase/migrations/20261109000000_baseline.sql \
  -f supabase/migrations/20261109010000_recovery.sql \
  -f tests/db/security.sql -f tests/db/history.sql
