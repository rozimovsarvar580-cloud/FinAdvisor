import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { getLaunchGateIssues } from "./launch-gate.mjs";

const completeEnv = {
  SITE_DOMAIN: "finadvisor.example",
  POSTGRES_PASSWORD: "test-password",
  DATABASE_URL: "postgresql://test",
  JWT_SECRET: "test-jwt-secret",
  NEXTAUTH_SECRET: "test-nextauth-secret",
  PAYMENT_PROVIDER: "stripe",
  OPENAI_API_KEY: "test-openai-key",
  SENTRY_DSN: "https://public@example.test/1",
};

function makeProject(t, { taxRules = "verified: true\n", source = "" } = {}) {
  const root = mkdtempSync(join(tmpdir(), "finadvisor-launch-gate-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const taxDirectory = join(root, "packages", "finance-engine", "src", "finance_engine");
  const sourceDirectory = join(root, "apps", "web", "src", "app", "[locale]");
  mkdirSync(taxDirectory, { recursive: true });
  mkdirSync(sourceDirectory, { recursive: true });
  writeFileSync(join(taxDirectory, "tax_rules_2026.yaml"), taxRules);
  writeFileSync(join(sourceDirectory, "page.tsx"), source);
  return root;
}

test("launch gate passes when launch criteria are satisfied", (t) => {
  const root = makeProject(t);
  assert.deepEqual(getLaunchGateIssues({ root, env: completeEnv }), []);
});

test("launch gate blocks unverified tax rules and shipped legal or decision markers", (t) => {
  const root = makeProject(t, {
    taxRules: "regimes:\n  turnover_tax:\n    verified: false\n",
    source: 'const disclaimer = "TODO(LEGAL): review";\nconst price = "TODO(DECISION D1)";\n',
  });
  const issues = getLaunchGateIssues({ root, env: completeEnv });
  assert.ok(issues.some((issue) => issue.includes("Unverified tax rule:")));
  assert.equal(issues.filter((issue) => issue.includes("Unresolved legal or decision marker:")).length, 2);
});

test("launch gate blocks missing production configuration and fake payments", (t) => {
  const root = makeProject(t);
  const issues = getLaunchGateIssues({
    root,
    env: { ...completeEnv, SITE_DOMAIN: " ", PAYMENT_PROVIDER: "fake", OPENAI_API_KEY: "", SENTRY_DSN: "" },
  });
  assert.ok(issues.some((issue) => issue.includes("Missing production environment variables: SITE_DOMAIN")));
  assert.ok(issues.some((issue) => issue.includes('PAYMENT_PROVIDER must be a live provider, not "fake"')));
  assert.ok(issues.some((issue) => issue.includes("OPENAI_API_KEY is missing")));
  assert.ok(issues.some((issue) => issue.includes("SENTRY_DSN is missing")));
});
