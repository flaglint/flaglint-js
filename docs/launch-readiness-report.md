# FlagLint Launch Readiness Report

Date: 2026-05-26
Branch: `test/launch-regression-matrix`
Reviewer stance: skeptical platform-engineering buyer

## Final Recommendation

**NO-GO until the npm metadata blocker is fixed.**

The product behavior, docs site build, command examples, SARIF policy output, migration safety boundaries, and enterprise demo all passed the local regression matrix. The release-facing metadata is not aligned: the repository and website state Node.js `>=20`, but the currently published npm metadata for `flaglint@0.4.1` reports `engines.node >=22`.

Do not release or promote the launch until npm package metadata, README, website, changelog, and tags agree.

## Blockers

1. **npm metadata Node engine mismatch**
   - Repository `package.json`: `engines.node >=20`
   - `package-lock.json` root package: `0.4.1`
   - README: Node.js 20 or newer
   - Website: supports Node.js 20+
   - Published npm metadata from `npm view flaglint version dist-tags engines --json`:
     ```json
     {
       "version": "0.4.1",
       "dist-tags": { "latest": "0.4.1" },
       "engines": { "node": ">=22" }
     }
     ```
   - Impact: enterprise CI users installing from npm see a stricter runtime than the repository and docs advertise.

## Non-Blocking Follow-Ups

1. `flaglint scan --format sarif` is valid SARIF but produces findings only for stale/review-signal scan results. The docs correctly use `validate --format sarif` for direct-SDK policy findings; keep this distinction prominent.
2. Wrapper function detection is scan inventory only. It is correctly not auto-rewritten, but the docs should continue to avoid implying wrapper codemods.
3. `validate` currently reports configured wrapper calls as direct LaunchDarkly policy findings when wrappers are configured. This is conservative and acceptable, but teams may want a separate policy mode later.
4. The docs site is static HTML. Route behavior for extensionless paths such as `/docs/getting-started` should be verified in the hosting layer after deployment.

## Matrix Results

| Area | Result | Evidence |
|---|---:|---|
| Node 20 | PASS | `nvm exec 20.19.4 npm test -- --run`: 14 files / 323 tests passed |
| Node 22 | PASS | `nvm exec 22.22.2 npm test -- --run`: 14 files / 323 tests passed |
| Docs build | PASS | `npm run build` succeeded; `www/index.html already in sync`; `tsup` built `dist/bin/flaglint.js` |
| TypeScript project scan | PASS | Fixture `src/ts-esm.ts` detected typed methods, dynamic key, detail method, and bulk call |
| JavaScript CommonJS scan | PASS | Fixture `src/js-cjs.js` detected CJS LaunchDarkly client usage before apply |
| ESM imports | PASS | `launchdarkly-node-server-sdk` ESM default import detected |
| CommonJS imports | PASS | `require("@launchdarkly/node-server-sdk")` detected |
| Aliased LaunchDarkly clients | PASS | Existing regression tests cover aliased clients; fixture used `ldClient`, `ld`, and `client` bindings by SDK provenance |
| Shared wrapper functions | PASS | Configured `wrappers: ["getFlag"]` detected `wrapped-checkout-enabled` as scan inventory |
| Imported OpenFeature client binding | PASS | `import { openFeatureClient as flags } from "../platform/feature-flags.js"` applied using local alias `flags` |
| Local OpenFeature client binding | PASS | `const openFeatureClient = OpenFeature.getClient()` allowed apply in `src/local-client.ts` |
| Dynamic flag keys | PASS | Reported as manual review; not auto-rewritten |
| bool/string/number/json variations | PASS | Dry-run and apply transformed to `getBooleanValue`, `getStringValue`, `getNumberValue`, `getObjectValue` |
| Detail evaluations | PASS | Reported as manual review; not auto-rewritten |
| Bulk calls | PASS | `allFlagsState()` reported as manual review; not auto-rewritten |
| Test-file exclusions | PASS | `--exclude-tests` removed `test-only-fixture` from scan inventory |
| Bootstrap exclusions | PASS | Enterprise demo hard gate excludes provider bootstrap and scans completed state |
| Dirty git working tree guard | PASS | `migrate --apply` exited 1 with dirty-tree error before writing |
| scan JSON | PASS | `reports/scan.json` parsed as JSON |
| scan Markdown | PASS | Markdown report generated with inventory and manual-review dynamic section |
| scan HTML | PASS | HTML report generated |
| scan SARIF | PASS | `reports/scan.sarif` parsed as SARIF 2.1.0 |
| migrate dry-run | PASS | Reported 6 reviewable diffs, 3 skipped manual-review usages |
| migrate apply | PASS | Transformed 6 call sites across 3 files on clean tree |
| validate CI exit code | PASS | `validate --no-direct-launchdarkly` exited 1 while manual direct calls remained |
| validate SARIF | PASS | SARIF rule id `flaglint.direct-launchdarkly`; 5 findings; partial fingerprints present |
| Enterprise demo clean clone | PASS | Build passed; scan and migrate dry-run passed; completed-state hard gate scanned 5 files and passed |
| README command claims | PASS | Representative scan, migrate, validate, and CI/SARIF commands reproduced with local built CLI |
| Website command claims | PASS | Homepage CTA/docs command claims match local CLI behavior; no unsupported migration claims found |
| Version alignment | FAIL | npm metadata engine mismatch: published `engines.node >=22` vs repo/docs/site `>=20` |

## Fixture Summary

Temporary fixture: `/private/tmp/flaglint-launch-matrix`

Fixture contents:
- `src/ts-esm.ts`: TypeScript ESM LaunchDarkly import, imported OpenFeature client alias, bool/string/number/json typed calls, dynamic key, detail call, bulk call.
- `src/js-cjs.js`: JavaScript CommonJS LaunchDarkly import and imported OpenFeature client binding.
- `src/local-client.ts`: local `OpenFeature.getClient()` binding.
- `src/wrapper.ts`: configured wrapper function call.
- `src/checkout.test.ts`: LaunchDarkly call excluded by `--exclude-tests`.
- `platform/feature-flags.ts`: provider/bootstrap module.

Key scan result with `--exclude-tests`:
```json
{
  "totalUsages": 10,
  "uniqueFlags": 8,
  "dynamic": 1,
  "bulk": 1,
  "detail": 1,
  "hasWrapper": true,
  "hasTest": false
}
```

Dry-run summary:
```text
LaunchDarkly usages found: 9
Safely automatable: 6 · Manual review: 3
Reviewable diffs: 6
Skipped usages: 3
```

Apply summary:
```text
Transformed: 6 call-site(s) across 3 file(s)
  ✓ js-cjs.js
  ✓ local-client.ts
  ✓ ts-esm.ts
```

Skipped manual-review examples:
```text
ts-esm.ts:13:24 — dynamic key requires manual review
ts-esm.ts:14:23 — detail methods skipped
ts-esm.ts:15:25 — bulk inventory call has no single-flag codemod
```

Validation SARIF summary:
```json
{
  "version": "2.1.0",
  "schema": "https://json.schemastore.org/sarif-2.1.0.json",
  "rule": "flaglint.direct-launchdarkly",
  "findings": 5,
  "hasPartial": true
}
```

Enterprise demo clean-clone hard gate:
```text
✓ validate --no-direct-launchdarkly: no direct LaunchDarkly evaluation calls found.
  Scanned 5 file(s).
```

## Metadata Checks

Repository metadata:
```json
{
  "pkg": "0.4.1",
  "lock": "0.4.1",
  "engines": { "node": ">=20" }
}
```

Tags:
```text
v0.4.1
v0.4.0
v0.3.0
```

Remote tags verified:
```text
refs/tags/v0.4.0
refs/tags/v0.4.1
```

Published npm metadata is the release blocker:
```json
{
  "version": "0.4.1",
  "dist-tags": { "latest": "0.4.1" },
  "engines": { "node": ">=22" }
}
```

## Go / No-Go

**NO-GO.**

The product behavior is credible for the documented scope, but the public npm metadata contradicts the runtime support claim. Fix the npm metadata alignment before release or launch messaging.
