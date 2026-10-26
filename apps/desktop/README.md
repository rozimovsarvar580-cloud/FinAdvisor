# FinAdvisor Desktop Agent

This directory contains the Windows/macOS Tauri desktop client for the agent.

The supported agent capabilities are intentionally narrow:

- device registration
- command history
- statement sync

The web API remains the source of truth. The desktop process must not perform
financial calculations; it only collects and synchronizes data. Session tokens
are held in memory while running and stored in the operating system keychain
for the signed-in session. Signing out removes the keychain entry.
The API URL accepts HTTPS, plus HTTP on loopback for local development.
The statement action currently queues an API command; it does not read local
bank files or import statement data.

## Run locally

1. Start the API using the instructions in `../api/README.md`.
2. Install Rust and the Tauri CLI (`cargo install tauri-cli --version "^2"`).
3. From this directory, run `cargo tauri dev`.

The Tauri CLI starts the static UI server on `127.0.0.1:1420`. The desktop UI
defaults to the local API at `http://127.0.0.1:8000`; use an HTTPS URL for a
remote API. API passwords are not persisted, and session tokens are never
written to ordinary files. Offline accounting submissions are stored in the
application data directory's SQLite database and retried with the same client ID.
The API is authoritative on conflicts; server timestamps win. Queue records are
removed only after the API acknowledges the idempotent submission.

## Checks

```powershell
npm test
cargo test --manifest-path src-tauri\Cargo.toml
```
