---
noteId: "5dd4b350da9c11f19fcb3b18069fac28"
tags: []

---

# Personal data and retention (operational draft)

This document describes current application behavior, not a legal privacy notice. A qualified reviewer
must verify the data inventory, legal basis, retention periods, backup handling, and jurisdiction-specific
rights before this description is published as a policy. `TODO(LEGAL)`.

## Account data

The API stores account identity and settings, saved business plans, accounting entries, chat messages,
marketplace activity, investor verification details, subscription and payment records, and security or
usage events where those features are used.

An authenticated owner can download a JSON export from Profile settings. It contains account fields and
the supported records associated with that account. Password hashes, refresh-token hashes, and payment
provider credentials are excluded.

The export does not currently include provider webhook event payloads. Those payloads are stored in an
unscoped event table and are not associated with individual accounts, so the current account export and
purge cannot identify or remove them by owner. Resolve this data inventory and retention gap before
publishing a comprehensive privacy policy (`TODO(LEGAL)`).

## Account deletion

An authenticated owner may request deletion from Profile settings. The current operational placeholder
is a 30-day grace period (`TODO(DECISION D16)`); the owner can cancel the request before it is purged.
Expired requests are processed by running `python -m finadvisor_api.purge_expired_accounts` from the API
environment. Operators must schedule that command daily; no scheduler is configured by this repository.

The purge removes the account and directly owned application records. Deletion behavior for legally
required financial records, security logs, and backups requires qualified review (`TODO(LEGAL)`).

## Analytics and browser storage

Essential application behavior does not depend on analytics consent. The localized consent banner records
acceptance or rejection against a random browser visitor identifier. Analytics events are accepted only
when the latest stored choice for that identifier is acceptance. The choice can be reopened and changed
from the privacy-preferences control.

The application currently stores the consent choice and visitor identifier in browser local storage. It
does not load a third-party analytics script in the consent component. Verify cookie/storage disclosure
and analytics retention before publication (`TODO(LEGAL)`).
