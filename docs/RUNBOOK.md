# Operations runbook

## Postgres backup and restore

The Compose Postgres service is named `postgres`. From the repository root, create a compressed custom-format dump with:

```sh
scripts/backup.sh backup
```

By default this writes a UTC timestamped file under `backups/`. Supply a path to choose another destination:

```sh
scripts/backup.sh backup /secure/backups/finadvisor.dump
```

Keep backup files outside the application host when possible, restrict access to them, and retain multiple known-good generations. The dump contains business and personal data. Protect it accordingly and verify the file is non-empty before transferring it. The script does not prune backups or upload them anywhere.

Restore a dump into the configured Compose database with:

```sh
scripts/backup.sh restore /secure/backups/finadvisor.dump
```

Restore uses `pg_restore --clean --if-exists`; it replaces matching database objects and data. Stop application writes before restoring and verify the target Compose project and database first. Set `POSTGRES_SERVICE`, `POSTGRES_USER`, and `POSTGRES_DB` when using a non-default Compose service or database. Ensure the corresponding Postgres role can create/replace objects. The script expects Docker Compose and PostgreSQL client tools in the Postgres container.

## Incident checklist

1. Record the incident time, symptoms, affected services, and the last known good backup. Preserve relevant logs without copying credentials into incident notes.
2. Stop or isolate API and web writes to prevent further changes while investigating. Keep Postgres available only to responders.
3. Check Postgres health and available disk space. Determine whether the issue is corruption, accidental data change, or an application release.
4. Select a known-good dump and verify its timestamp and size. If the current database may contain recoverable changes, take a separate backup before restoring.
5. Confirm the target database and notify affected operators that restoring will replace matching objects and data.
6. Restore using the command above. Review the command output and confirm the restore exited successfully.
7. Start the API, check its `/ready` endpoint and logs, then start web traffic. Confirm key owner-scoped records and normal read/write behavior.
8. Document the recovery point, recovery duration, data loss (if any), and follow-up actions. Keep the incident and backup access restricted.

## Rollback steps

If a restore or application release causes a new failure:

1. Stop API and web writes again.
2. If the restore partially failed, restore the pre-restore dump taken in the incident checklist. If an application release caused the problem, roll the application image/code back to the last known good release.
3. Recheck Postgres and API `/ready`, then verify representative records and application behavior before reopening writes.
4. If no valid pre-restore dump exists, preserve the current database state and escalate to the database operator; do not repeatedly restore unverified dumps.
