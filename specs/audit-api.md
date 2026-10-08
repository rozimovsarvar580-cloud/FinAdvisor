---
noteId: "95531530c30c11f1b92d93b180ce68c9"
tags: []

---

# API tree audit

Audited on 2026-10-08. The requested legacy tree, `apps/api/app`, is absent from the working tree (and has no tracked files). Therefore it contains no routers, models, or tests that can be identified as legacy-only or port candidates. No application code was changed.

The canonical API source tree is `apps/api/src/finadvisor_api`. It contains the current modules, including a `legacy` package and its `legacy/routers` subpackage; these are part of the `src` tree, not contents of the absent `apps/api/app` tree. The actual canonical test tree is `apps/api/tests` (31 `test_*.py` files); there is no `apps/api/app/tests` tree.

| Category requested | Files found only in `apps/api/app` | Filesystem finding |
| --- | --- | --- |
| Routers | None | `apps/api/app` is absent. |
| Models | None | `apps/api/app` is absent. |
| Tests | None | `apps/api/app` is absent; canonical tests are in `apps/api/tests`. |

This records the current filesystem only; no contents or historical files were inferred for the absent tree.
