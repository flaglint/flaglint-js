# ADR 004 — Policy-as-Code (.flaglintpolicy.yaml)

Date: 2026-06
Status: PROPOSED

## Decision

Introduce `.flaglintpolicy.yaml` as a separate governance layer above `.flaglintrc`.
It defines org-level enforcement rules: required OpenFeature boundary per service,
banned call patterns, max source-level flag age, and an exception registry with
mandatory expiry dates. `flaglint validate` reads and enforces it.

## Context

`.flaglintrc` is scanner config — it controls what FlagLint detects (excludes,
wrappers, minFileCount). Policy config is a different concern: it defines what is
*acceptable* versus what is a *violation*, at an org level.

Currently a platform team can only use `flaglint validate --no-direct-launchdarkly`
as a binary gate. There is no way to express rules like:

- "This service may not introduce any new dynamic-key calls"
- "Flags older than 90 days of source-level inactivity require a review comment"
- "The `allFlagsState` pattern is banned org-wide except in the bootstrap file"
- "`checkout-v2` is exempted from the age rule until 2026-09-01 (migration in flight)"

Without policy-as-code, these rules live in Slack, wikis, and institutional memory —
not in the repo, not reviewable in PRs, not auditable.

## Proposed Schema (.flaglintpolicy.yaml)

```yaml
version: 1

rules:
  no-dynamic-keys:
    enabled: true
    severity: error          # error | warning

  no-bulk-state:
    enabled: true
    severity: error
    allow:
      - src/bootstrap/launchdarkly.ts   # only the bootstrap file may use allFlagsState

  max-source-flag-age-days: 90          # source-level inactivity signal only, not production

  require-openfeature-boundary:
    enabled: true            # flaglint validate fails if any direct LD call is found

exceptions:
  - flag: checkout-v2
    rule: max-source-flag-age-days
    reason: "Migration in flight — PR #87"
    expires: 2026-09-01      # CI fails after this date even with the exception listed
```

## Reasoning

- **Reviewable in PRs.** The policy file lives in the repo. Changes to what is allowed
  require a code review. This is auditable for SOC 2 and change management processes.

- **Exception rot prevention.** Every exception requires an expiry date. After expiry,
  `flaglint validate` fails even if the exception is still listed. Teams are forced to
  either extend with a new date (and a new PR) or resolve the underlying issue.

- **Separates detection from governance.** `.flaglintrc` stays focused on scanner
  behavior. `.flaglintpolicy.yaml` stays focused on what is allowed. They are
  independently versioned and independently optional.

- **`flaglint validate` is the natural enforcement point.** It already exits 1 on
  violations and emits SARIF. Policy violations become additional rule IDs:
  `flaglint.policy-no-dynamic-keys`, `flaglint.policy-max-age`, etc.

- **Enterprise unlock.** This is the feature that makes a platform team lead adopt
  FlagLint permanently — not as a migration tool, but as governance infrastructure.
  A VP of Engineering can point to `.flaglintpolicy.yaml` in a compliance review.

## Constraints

- Must be additive. Users without a `.flaglintpolicy.yaml` see no behavior change.
- Must not merge with `.flaglintrc`. Two files, two concerns, both optional.
- Exception expiry must be enforced strictly. An expired exception is a hard failure,
  not a warning.
- Severity `warning` emits to SARIF but does not change exit code.
  Severity `error` exits 1.

## Prerequisites

- **Semantic flag fingerprints** — stable identifiers for flag usages that survive
  file moves and refactors. Exception registry entries keyed by line number break on
  every file change. Fingerprints (hash of callType + flagKey + normalizedFile +
  containingSymbol) are stable across renames. This should be designed before
  the exception registry is implemented.

## Consequences

- New Zod schema for `.flaglintpolicy.yaml` in `src/config.ts` or a new
  `src/policy.ts` module.
- `flaglint validate` gains a `--policy <path>` option and auto-discovers
  `.flaglintpolicy.yaml` from the scan root.
- SARIF output gains new rule IDs per policy rule type.
- Requires a new docs section: `/docs/cli/policy/` with schema reference and examples.
- Semantic fingerprints should be designed as a prerequisite (see above).
