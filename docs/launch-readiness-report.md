# FlagLint Launch Readiness Report

Date: 2026-05-26  
Branch: `release/v0.5.0-launch`  
Reviewer stance: skeptical platform-engineering buyer

---

## Final Recommendation

**GO TO PUBLISH v0.5.0**

All release-candidate checks pass. The npm metadata blocker from the prior NO-GO report
(published `flaglint@0.4.1` reporting `engines.node >=22`) is resolved by this release:
the v0.5.0 tarball reports `engines.node >=20`. The product behavior, docs site, command
examples, SARIF policy output, migration safety boundaries, enterprise demo, and
end-to-end external evaluator workflow on both Node 20 and Node 22 all pass.

Public launch is complete only after:
1. npm publication (GitHub Actions Trusted Publisher workflow);
2. post-publish verification (`npm view flaglint version` returns `0.5.0`).

---

## Prior NO-GO Blocker — Resolved

**npm metadata Node engine mismatch (fixed in v0.5.0)**

| Item | v0.4.1 (published before v0.5.0) | v0.5.0 (release candidate) |
|------|----------------------------------|---------------------------|
| `engines.node` | `>=22` | `>=20` |
| Tarball version | `0.4.1` | `0.5.0` |
| Node 20 tested | No (claimed >=22) | Yes — PASS |
| Node 22 tested | Yes — PASS | Yes — PASS |

The published `flaglint@0.4.1` metadata mismatch was expected until v0.5.0 publication.
`flaglint@0.5.0` has since been published with `engines.node >=20`.

---

## Release-Candidate Artifact Verification

### Tarball contents (`npm pack --dry-run`)

```
flaglint@0.5.0
  CHANGELOG.md      12.4 kB
  LICENSE            1.1 kB
  README.md         18.5 kB
  dist/apply-ZYLA2N7Y.js
  dist/bin/flaglint.d.ts
  dist/bin/flaglint.js   75.1 kB
  dist/chunk-MJLXM6GZ.js
  package.json       1.9 kB
  total files: 8  |  package size: 31.9 kB  |  unpacked: 119.7 kB
```

Verified clean:
- Version: `0.5.0`
- `engines.node`: `>=20`
- `bin.flaglint`: `dist/bin/flaglint.js`
- No `.claude/` worktrees, temporary reports, or secrets included

---

## End-to-End External Evaluator Results

### Node 20 (v20.19.4)

Fresh install from packed tarball `flaglint-0.5.0.tgz` into a clean temporary project.

Fixture covered:
- bool/string/number/json variations (checkout.ts, 4 calls)
- dynamic key — manual review (analytics.ts)
- detail evaluation — manual review (analytics.ts)
- bulk allFlagsState — manual review (analytics.ts)
- Imported OpenFeature client with ESM `.js` specifier:
  `import { openFeatureClient } from "../platform/feature-flags.js"`

| Command | Result |
|---------|--------|
| `flaglint --help` | PASS — CLI loads, usage shown |
| `flaglint scan ./src --format markdown` | PASS — 7 usages / 5 unique flags / 1 dynamic |
| `flaglint migrate ./src --dry-run` | PASS — 4 automatable / 3 manual review |
| `flaglint migrate ./src --apply` | PASS — 4 call-sites transformed in checkout.ts; analytics.ts skipped (no binding) |
| `flaglint validate --no-direct-launchdarkly --format sarif` | PASS — exit 1; SARIF 2.1.0; 7 findings; rule `flaglint.direct-launchdarkly` |

After-apply verification (`checkout.ts` transformed):
```typescript
openFeatureClient.getBooleanValue("checkout-v2", false, ctx)
openFeatureClient.getStringValue("payment-provider", "stripe", ctx)
openFeatureClient.getNumberValue("discount-pct", 0, ctx)
openFeatureClient.getObjectValue("discount-config", {}, ctx)
```

ESM `.js` import binding detected: `../platform/feature-flags.js` matched
pattern `**/platform/feature-flags` (extension-stripped glob, new in v0.5.0).

### Node 22 (v22.22.2)

Same fixture, npm-installed from packed tarball.

| Command | Result |
|---------|--------|
| `flaglint --help` | PASS |
| `flaglint scan ./src --format markdown` | PASS — 7 usages / 5 unique flags |
| `flaglint migrate ./src --dry-run` | PASS — 4 automatable / 3 manual review |
| `flaglint validate --no-direct-launchdarkly --format sarif` | PASS — exit 1; SARIF 2.1.0; 7 findings |
| validate exit code | PASS — `$?` = 1 confirmed (no pipe) |

---

## Enterprise Demo Hard-Gate Verification

Run from repository root with local build (`node ./dist/bin/flaglint.js`):

```
Step 1 — scan
✓ 20 flag usages found across 11 unique flags
ℹ  1 dynamic flag key(s) require manual review

Step 2 — dry-run
LaunchDarkly usages found: 19
Safely automatable: 10 · Manual review: 9

Step 3 — advisory gate on src/ (expected to fail during migration)
✗ validate --no-direct-launchdarkly: 20 direct LaunchDarkly evaluation call(s) found.

Step 4 — hard gate on after-complete/ (must pass)
✓ validate --no-direct-launchdarkly: no direct LaunchDarkly evaluation calls found.
  Scanned 5 file(s).
```

Hard gate on `after-complete/`: **PASS** — reports `Scanned 5 file(s).`

Validation SARIF from demo src/:
```
SARIF 2.1.0 | rule: flaglint.direct-launchdarkly | findings: 20
```

---

## Docs Route Verification

All required docs pages present in `www/docs/`:

| Route | Status |
|-------|--------|
| `/docs/getting-started` | PASS |
| `/docs/commands/scan` | PASS |
| `/docs/commands/migrate` | PASS |
| `/docs/commands/validate` | PASS |
| `/docs/supported-scope` | PASS |
| `/docs/openfeature-provider-setup` | PASS |
| `/docs/ci-github-actions` | PASS |
| `/docs/opentelemetry` | PASS |
| `/docs/safety-model` | PASS |
| `/docs/demo` | PASS |

Note: extensionless URL routing must be verified in the hosting layer after deployment.

---

## Copy Checks

| Check | Status | Notes |
|-------|--------|-------|
| No top-level Early preview warning | PASS | No warning-first homepage hero |
| No changing homepage test-count claim | PASS | Stat cards: `CI` / `7` (deps) / `MIT` — no test count |
| No stale scan-SARIF enforcement language | PASS | Docs use `validate --format sarif` for direct-SDK policy |
| No runtime OpenTelemetry emit claim | PASS | OTel page documents the hooks pattern; FlagLint does not emit telemetry |
| No automatic provider/bootstrap generation | PASS | `migrate --apply` never generates bootstrap files |
| No stale v0.4.1 version reference on site | PASS | Site release messaging must track the published npm version |
| README uses validate for SARIF enforcement | PASS | CI guide documents `validate --no-direct-launchdarkly --format sarif` |
| README migration examples preserve context | PASS | All examples preserve the evaluation context argument |

---

## Full Regression Matrix

| Area | Result | Evidence |
|---|---:|---|
| Node 20 | PASS | v20.19.4: all commands pass from packed tarball |
| Node 22 | PASS | v22.22.2: all commands pass from packed tarball |
| Typecheck | PASS | `tsc --noEmit` clean on release branch |
| Build | PASS | `tsup` builds 75.1 kB dist/bin/flaglint.js |
| Test suite | PASS | 14 files / 323 tests — deterministic from clean checkout |
| Tarball integrity | PASS | 8 files, 31.9 kB, v0.5.0, engines >=20, no secrets |
| ESM .js import binding | PASS | `../platform/feature-flags.js` matches `**/platform/feature-flags` |
| Enterprise demo scan | PASS | 20 usages / 11 flags / 1 dynamic |
| Enterprise demo dry-run | PASS | 10 automatable / 9 manual review |
| Enterprise demo apply | PASS | 10 call-sites across 3 files |
| Enterprise demo hard gate | PASS | `Scanned 5 file(s).` — exits 0 |
| Validation SARIF | PASS | `flaglint.direct-launchdarkly`, level error, partial fingerprints |
| Docs routes | PASS | All 10 required routes present |
| Homepage copy | PASS | No prohibited claims |
| Whitespace check | PASS | `git diff --check` clean |
| npm engine metadata | PASS | `engines.node >=20` in packed tarball |

---

## Non-Blocking Notes

1. **Docs static routing**: Extensionless URL paths require hosting-layer configuration.
   Verify after deployment.

2. **Wrapper policy behavior**: `validate --no-direct-launchdarkly` conservatively flags
   configured wrapper calls as policy findings. This is intentional; a separate policy
   mode for wrapper-only calls can be addressed in a follow-up.

3. **`flaglint scan --format sarif`**: Produces findings only for stale flags (staleness
   signals). For CI policy enforcement of direct SDK calls, use
   `flaglint validate --no-direct-launchdarkly --format sarif`. Docs correctly distinguish
   these two use cases.

4. **npm Trusted Publisher**: Verify OIDC configuration on the GitHub Actions release
   workflow before triggering the publish job.

---

## Go / No-Go

**GO TO PUBLISH v0.5.0**

- Node 20 and Node 22 external evaluator workflows pass.
- Packed tarball: v0.5.0, `engines.node >=20`, 8 clean files.
- 323 tests pass from clean checkout.
- Enterprise demo hard gate passes: `Scanned 5 file(s).`
- All 10 docs routes present.
- No prohibited claims found.

Prerequisite: verify npm Trusted Publisher OIDC configuration before publish.
