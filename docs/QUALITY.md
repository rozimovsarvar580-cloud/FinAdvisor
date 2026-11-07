---
noteId: "f9add3d0da9f11f19fcb3b18069fac28"
tags: []

---

# Quality audit

## Lighthouse

Measured 2026-11-07 with Lighthouse 13.6.0 and Headless Chrome 156 using the default mobile emulation (Moto G Power 2022).

| Route | Performance | SEO | First Contentful Paint | Largest Contentful Paint | Total Blocking Time |
|---|---:|---:|---:|---:|---:|
| `/en` | 99 | 100 | 1.7 s | 1.7 s | 10 ms |
| `/en/pricing` | 100 | 100 | 1.5 s | 1.5 s | 0 ms |

The audit used the production build's pre-rendered route HTML and hashed assets. The local Next.js production server returned HTTP 429 from its middleware, so a temporary static server was used for measurement. This measures the generated pages and assets, but does not measure Next.js middleware, server rendering, or deployment-network behavior; repeat the audit against the deployed origin before release.

The landing page's above-the-fold copy is rendered without a hydration-dependent entrance animation so its heading can be painted immediately. The audited pages use no raster hero imagery; the dashboard preview is rendered as UI and SVG. Fonts are self-hosted by `next/font`, use `font-display: swap`, and have `preload: true` configured. The static audit harness does not reproduce Next.js runtime font-preload hints.
