# Error monitoring and source maps

Error reporting is disabled when `SENTRY_DSN` is unset. Set it in the API and desktop process environments. For the browser bundle, set `NEXT_PUBLIC_SENTRY_DSN` to the same Sentry project DSN; keep it unset to disable browser reporting. Do not put auth tokens, request bodies, or personal data in monitoring context.

The API's FastAPI integration captures unhandled exceptions without default PII. The web root error boundary reports caught render errors. The desktop initializes the Sentry Rust SDK when its process receives `SENTRY_DSN`.

Web production builds never publish browser source maps. If symbolicated production stacks are needed, generate maps in CI and upload them directly to Sentry with the release upload tooling, then delete them before packaging deployment assets. Keep upload credentials in CI secrets. Do not enable `productionBrowserSourceMaps` for deployed builds.
