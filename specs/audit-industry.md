---
noteId: "9b913010e5b911f190da7981740d7822"
tags: []

---

# Restaurant-specific code audit

Audit scope: the repository as of 2026-11-21. Searched tracked project files
for `restaurant`, `restaurants`, `restoran`, and `ресторан`, then checked
domain-specific inputs such as `restaurant_format`, `menu_summary`, `seats`,
`average_check`, `daily_customers`, `kitchen_equipment`, `cook`, and `server`.
This is an inventory and disposition, not an implementation change.

## Decisions

The roadmap establishes support for all business types, with a sector registry
and restaurant as one template. Accordingly:

- **Generalize** shared product paths to accept a sector and sector-defined
  inputs. Keep API compatibility for existing restaurant plans during migration.
- **Keep as a sector template** restaurant-only examples, sample data, and
  model behavior, eventually selected through `restaurant_cafe` definitions.
  Preserve current restaurant calculation results as migration parity tests.
- **Delete/retire** duplicated static demo routes or UI stubs when their live
  generic replacement is ready; do not remove historical migrations or
  restaurant test fixtures that protect existing behavior.
- No benchmark, license, tax, or market facts are authorized by this audit.
  Existing unverified catalog values stay unverified and owner-editable.

## Inventory

| Area and locations | Current restaurant-specific content | Decision |
| --- | --- | --- |
| Finance engine: [restaurant.py](../packages/finance-engine/src/finance_engine/restaurant.py), [startup_cost.py](../packages/finance-engine/src/finance_engine/startup_cost.py), [startup_cost_catalog.yaml](../packages/finance-engine/src/finance_engine/startup_cost_catalog.yaml) | A restaurant projection uses average check, daily customers, rent/utilities, payroll and equipment; startup categories include kitchen equipment and initial stock. Catalog prices are null and marked `TODO(VERIFY)`. | Keep the existing calculation as the `restaurant_cafe` template; generalize the engine around sector-defined revenue models and cost categories, retaining Decimal behavior and golden parity tests. Keep the unverified catalog as editable template structure; do not populate unsupported prices. |
| API plan contract and generation: [plan_schemas.py](../apps/api/src/finadvisor_api/plan_schemas.py), [plans.py](../apps/api/src/finadvisor_api/plans.py) | `PlanGenerateRequest` requires `restaurant_format`, seats, menu summary, average check and daily customers. `PLAN_PROMPT` explicitly requests a restaurant plan; context and calculations use the restaurant projection. | Generalize to `sector_id` and validated sector inputs; build prompts and calculations from the selected sector definition. Preserve a compatibility path for saved/existing restaurant plans. |
| API exports: [documents.py](../apps/api/src/finadvisor_api/documents.py), [document_messages.json](../apps/api/src/finadvisor_api/document_messages.json) | PDF/XLSX/bank-pack generation calls the restaurant projection and exports restaurant format, menu, seats and restaurant format names in uz/ru/en. | Generalize shared rendering and labels from plan/sector metadata; keep the current restaurant labels and calculations in the `restaurant_cafe` template. Add multi-sector export parity tests before changing output. |
| Bank readiness: [bank_checklist.yaml](../apps/api/src/finadvisor_api/data/bank_checklist.yaml), [readiness.py](../apps/api/src/finadvisor_api/readiness.py) | The checklist criteria and keywords are business-neutral; no restaurant-specific entries were found. | Keep generic checklist unchanged. If sector-specific evidence is later required, add sourced/versioned sector checklists rather than restaurant-only rules to the common checklist. |
| Knowledge: [knowledge_seed.json](../apps/api/src/finadvisor_api/knowledge_seed.json) | One entry is explicitly about restaurant operating risks and food-service compliance. | Keep as sector-scoped knowledge; attach sector metadata and filter retrieval by sector. Retain the owner-validation caution and do not generalize food-service guidance to other businesses. |
| Demo seed and documentation: [seed_demo.py](../apps/api/src/finadvisor_api/seed_demo.py), [apps/api README](../apps/api/README.md), [api-load-smoke.py](../scripts/api-load-smoke.py) | The demo creates a fictional restaurant plan/listing/accounting history; setup and smoke-test examples refer to that plan and restaurant assumptions. | Keep the demo explicitly labeled as the restaurant sector sample. Generalize operational API documentation; preserve seed instructions and keep the load smoke fixture clearly identified as a sector-specific baseline (add other sectors when supported). |
| Legacy API examples: [wizard.py](../apps/api/src/finadvisor_api/legacy/routers/wizard.py), [investors.py](../apps/api/src/finadvisor_api/legacy/routers/investors.py), [dashboard.py](../apps/api/src/finadvisor_api/legacy/routers/dashboard.py) | Wizard step names a restaurant profile; investor discovery returns static restaurant listings; dashboard returns a `restaurant` field and a fixed restaurant name. These routers are mounted under `/api/v1`. | Generalize the wizard and dashboard field to business/sector terminology. Delete the static investor fixture payload in favor of owner-published marketplace data; keep the route contract only if still needed by clients. |
| Marketplace migration: [20261004_01_marketplace_listings.py](../apps/api/migrations/versions/20261004_01_marketplace_listings.py) | The migration docstring says “restaurant marketplace”; the stored columns themselves are generic business/listing fields. | Keep immutable migration history; no schema rewrite is needed. Add sector data with a forward migration when the sector-aware marketplace is implemented. |
| Web wizard: [plan-wizard.tsx](../apps/web/src/components/finadvisor/plan-wizard.tsx), [plans/new/page.tsx](../apps/web/src/app/[locale]/plans/new/page.tsx) | Main wizard hardcodes restaurant format enum, restaurant draft key, seats/menu/customer inputs and restaurant labels. The older `plans/new` route is a restaurant-name form stub. | Generalize the main wizard to sector-driven steps and inputs; keep restaurant as a selectable template and migrate its saved draft. Delete or redirect the duplicate stub once the canonical wizard route owns plan creation. |
| Web product copy: [en.json](../apps/web/src/messages/en.json), [ru.json](../apps/web/src/messages/ru.json), [uz.json](../apps/web/src/messages/uz.json) | Restaurant references occur in landing/about copy, initial audience/product positioning, investor brief, onboarding, wizard labels, and marketplace text. | Generalize product-wide copy and marketplace wording in all locales. Keep restaurant wording only for the restaurant example/template, format choices, and sector-specific labels. Preserve “starting with restaurants” while it remains an accurate launch-scope statement; update only when launch scope changes. |
| Legacy locale copy: [packages/i18n en.json](../packages/i18n/messages/en.json), [packages/i18n ru.json](../packages/i18n/messages/ru.json), [packages/i18n uz.json](../packages/i18n/messages/uz.json) | FAQ says the planning tools currently focus on restaurant businesses; preparation FAQ uses menu-oriented examples. | Generalize shared audience/help copy, keeping menu as one example alongside services/products. Remove these duplicate catalogs only if their legacy route/imports are retired. |
| Product and investor docs: [PRODUCT.md](../docs/PRODUCT.md), [INVESTOR.md](../docs/INVESTOR.md), [copilot-instructions.md](../.github/copilot-instructions.md), [TASKS.md](./TASKS.md) | These state the current restaurant starting scope, demo examples, or future multi-sector requirement. | Keep accurate launch-scope/history statements and the restaurant-template example. Generalize implementation rules and investor audience claims as sector support ships; do not present unverified market size or customer segments as facts. |
| Email copy | `auth_email_messages.json` and the user-facing email templates contain no restaurant-specific wording. `email_sender.py` uses generic templates. | Keep email templates business-neutral. No code change is needed; add sector context only if a documented email workflow requires it. |
| Desktop agent | No restaurant-specific wording or sector logic was found in the desktop app source, UI messages, or tests. | Keep the desktop protocol and UI business-neutral; consume sector-neutral accounting/agent records. |

## Test and fixture inventory

Restaurant names and assumptions appear in these tests. They are fixtures, not
production copy; keep them where they exercise restaurant-template behavior,
and use neutral fixtures for generic behavior as multi-sector tests are added.

- Finance engine: [test_restaurant.py](../packages/finance-engine/tests/test_restaurant.py), [test_startup_cost.py](../packages/finance-engine/tests/test_startup_cost.py).
- API auth/profile/test identities: [test_agent_api.py](../apps/api/tests/test_agent_api.py), [test_auth.py](../apps/api/tests/test_auth.py), [test_auth_core.py](../apps/api/tests/test_auth_core.py), [test_auth_email_flows.py](../apps/api/tests/test_auth_email_flows.py), [test_auth_oauth.py](../apps/api/tests/test_auth_oauth.py), [test_authorization_matrix.py](../apps/api/tests/test_authorization_matrix.py), [test_support.py](../apps/api/tests/test_support.py), [test_email_sender.py](../apps/api/tests/test_email_sender.py).
- API plans, analysis, readiness, knowledge and exports: [test_ai_number_consistency.py](../apps/api/tests/test_ai_number_consistency.py), [test_bank_readiness_eval.py](../apps/api/tests/test_bank_readiness_eval.py), [test_document_analysis.py](../apps/api/tests/test_document_analysis.py), [test_documents.py](../apps/api/tests/test_documents.py), [test_export_pdf.py](../apps/api/tests/test_export_pdf.py), [test_export_xlsx.py](../apps/api/tests/test_export_xlsx.py), [test_knowledge.py](../apps/api/tests/test_knowledge.py), [test_plans.py](../apps/api/tests/test_plans.py), [test_readiness.py](../apps/api/tests/test_readiness.py), [test_seed_demo.py](../apps/api/tests/test_seed_demo.py), [test_marketplace.py](../apps/api/tests/test_marketplace.py).
- Web fixtures and flows: [InvestorVerificationQueue.test.tsx](../apps/web/src/app/[locale]/admin/InvestorVerificationQueue.test.tsx), [page.test.tsx](../apps/web/src/app/[locale]/investors/kyc/page.test.tsx), [route.test.ts](../apps/web/src/app/api/plans/generate-and-save/stream/route.test.ts), [auth-forms.test.tsx](../apps/web/src/components/auth/auth-forms.test.tsx), [profile-settings.test.tsx](../apps/web/src/components/auth/profile-settings.test.tsx), [calculator-workspace.test.tsx](../apps/web/src/components/finadvisor/calculator-workspace.test.tsx), [plan-wizard.test.tsx](../apps/web/src/components/finadvisor/plan-wizard.test.tsx), [reports-panel.test.tsx](../apps/web/src/components/finadvisor/reports-panel.test.tsx), [shared-plan-view.test.tsx](../apps/web/src/components/finadvisor/shared-plan-view.test.tsx), [support-contact-form.test.tsx](../apps/web/src/components/support/support-contact-form.test.tsx), [auth.test.ts](../apps/web/src/lib/auth.test.ts), [documents.test.ts](../apps/web/src/lib/documents.test.ts), [investor-marketplace.test.ts](../apps/web/src/lib/investor-marketplace.test.ts), [site-metadata.test.ts](../apps/web/src/lib/site-metadata.test.ts), [core-flows.spec.ts](../apps/web/tests/e2e/core-flows.spec.ts).

The public demo, investor brief, and current restaurant-only plan workflow are
intentional launch-scope examples. Generalization belongs to the sector
registry/model/API tasks in Stage 14; this audit does not make those changes.
