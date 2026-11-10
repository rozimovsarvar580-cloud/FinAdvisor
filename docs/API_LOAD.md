---
noteId: "4c2f1d00dd0f11f1a2f42f39c6285f96"
tags: []

---

# API load smoke

Run `python scripts/api-load-smoke.py` from the repository root. The script makes
10 sequential requests per route by default and reports p50/p95 latency for:

- `POST /auth/login`: p95 target <= 2000 ms
- `POST /plans/generate`: p95 target <= 500 ms
- `GET /reports/month`: p95 target <= 250 ms

The script runs the FastAPI app in-process against a temporary SQLite database,
creates a disposable owner, and replaces plan generation with deterministic fake
AI. It does not read AI configuration, use external services, modify the project
database, or report authentication tokens. Use `--requests 1` for a quick check,
or `--max-p95-ms 1000` to override all three latency targets. Requests are
sequential and capped at 20 per route to stay below the API's request limits.

These are local smoke-test ceilings, not production SLOs: in-process timings
exclude network, deployment, database, and real AI-provider latency.
