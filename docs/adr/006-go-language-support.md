# ADR 006 — Go Language Support

Date: 2026-06
Status: PROPOSED

## Decision

Add Go as a second language engine in FlagLint, targeting the LaunchDarkly Go
server SDK (`github.com/launchdarkly/go-server-sdk`). Distribution stays as a
single npm CLI. Go support begins as audit-only (inventory + risk classification).
Migration rewrites are out of scope until audit is proven.

## Context

FlagLint currently supports TypeScript and JavaScript (Node.js server SDK only).
The LaunchDarkly Go server SDK is widely used — particularly in platform and
infrastructure teams, which are the primary enterprise buyer for FlagLint.
A TypeScript-only tool is easy for Go-heavy organizations to dismiss.

OpenFeature has a stable Go SDK (`go.openfeature.dev/sdk`), so the migration
target exists. The question is not whether to support Go but how and in what
sequence.

## Architecture

### Core / Language split

The current structure (`src/scanner/`, `src/reporter/`, `src/migrator/`) is
TypeScript-specific. As a second language is added, a shared core must be
separated from language-specific logic.

**Target structure:**

```
src/
  core/
    findings/       # shared Finding, FlagUsage, ScanResult types
    risk/           # risk classification engine (language-agnostic)
    reports/        # formatReport(), SARIF emitter, JSON schema
    policy/         # .flaglintpolicy.yaml enforcement (ADR 004)
    fingerprints/   # stable flag fingerprints (prerequisite for policy exceptions)

  languages/
    typescript/
      scanner/      # existing AST scanner, moved
      migrator/     # existing migrator, moved
      fixtures/
    go/
      scanner/      # new — see below
      patterns/     # Go SDK method signatures, import paths
      fixtures/
      README.md     # documents what is and is not supported
```

**Sequencing constraint:** Do not reorganize `src/` into this structure
speculatively. Add `src/languages/go/` first. Prove Go scanning works end-to-end.
Then move the TypeScript scanner into `src/languages/typescript/` to match.
Earn the abstraction before enforcing it.

### Language detection

FlagLint auto-detects languages from file extensions in the scan directory:

- `.ts`, `.tsx`, `.js`, `.jsx` → TypeScript engine
- `.go` → Go engine

`--language <lang>` is a **filter**, not a gate. Users should not need to specify
the language to get correct results. `--language go` means "only scan Go files,
skip everything else." Omitting the flag scans all detected languages.

### Distribution

Primary distribution stays npm:

```bash
npx flaglint audit ./services
npx flaglint audit ./services --language go
```

A Go-native binary (`go install github.com/flaglint/flaglint-go/cmd/flaglint-go@latest`)
is a future option, only if Go users specifically request it. It must not diverge from
the npm CLI in JSON schema, SARIF output, or policy enforcement behavior.

## Parser

**Chosen approach:** tree-sitter-go via `node-tree-sitter` with the official Go grammar.

**Rationale:** tree-sitter is the only JavaScript-compatible Go parser with production
usage. It handles the full Go grammar including generics (Go 1.18+). The `node-tree-sitter`
package provides Node.js bindings.

**Prerequisite before implementation:** A parser spike must validate:

1. `node-tree-sitter` + `tree-sitter-go` grammar bundles acceptably inside an npm package
   (weight, install time, binary compatibility across Node 20/22 on macOS/Linux/Windows)
2. The Go grammar correctly identifies method call expressions, import declarations,
   and package-level variable bindings needed for client detection
3. Cross-platform native module behavior in CI (GitHub Actions, Node 20/22 matrix)

If the spike finds tree-sitter is too heavy or brittle for npm distribution, the
fallback is a targeted regex + import-line scanner for Phase 1 (audit only), with
tree-sitter deferred to Phase 2 when semantic accuracy matters more.

## Client Binding Detection

The hardest Go-specific problem is identifying which variable holds the LaunchDarkly
client. Go uses package import aliases and constructor patterns:

```go
// Import with alias
import ld "github.com/launchdarkly/go-server-sdk/v7"

// Client construction (package-level or inside a struct)
client, err := ld.MakeClient(sdkKey, 5*time.Second)

// Later usage
result, _ := client.BoolVariation("checkout-v2", ldCtx, false)
```

The scanner must trace:
1. Import declarations for `github.com/launchdarkly/go-server-sdk` (v6 or v7)
   to identify the package alias (`ld` in the example above, but could be anything)
2. Variable bindings where `<alias>.MakeClient(...)` is the right-hand side
3. Method calls on those bound variables

This is the same import-tracing problem FlagLint already solves for TypeScript.
The Go version is simpler in one way (no re-exports, no barrel files) and harder
in another (package-level variables, struct fields, function parameters).

Phase 1 may use a heuristic: any variable receiving a value from
`<ld-package-alias>.MakeClient(...)` is treated as the client. This covers the
majority of real usage without full type analysis.

## Go module boundaries

A monorepo with multiple Go services has multiple `go.mod` files. The scanner
must discover `go.mod` boundaries and report file paths relative to the module
root, matching the same relative-path contract FlagLint uses for TypeScript
(see project memory: relative paths in FlagUsage).

When scanning a directory that contains multiple `go.mod` files, each module is
treated as an independent scan unit. Findings from multiple modules are merged
into a single report with module-relative paths.

## Target SDK and Method Signatures

**Supported SDK:** `github.com/launchdarkly/go-server-sdk` v6 and v7.

**Phase 1 detection targets:**

| Method | Risk | Notes |
|---|---|---|
| `BoolVariation(key, ctx, default)` | low | static key only |
| `StringVariation(key, ctx, default)` | low | static key only |
| `IntVariation(key, ctx, default)` | low | static key only |
| `Float64Variation(key, ctx, default)` | low | static key only |
| `JSONVariation(key, ctx, &result)` | medium | pointer output, manual review |
| `BoolVariationCtx(ctx, key, ldCtx, default)` | low | newer signature with Go ctx |
| `BoolVariationDetail(key, ctx, default)` | high | returns EvaluationDetail |
| `AllFlagsState(ctx, ...)` | high | bulk call, no OpenFeature equivalent |
| Dynamic key (variable or fmt.Sprintf) | high | cannot resolve statically |

**Out of scope for Phase 1:** wrapper functions, struct methods that proxy the client,
interface types that satisfy an LD client interface.

## JSON Output Schema

Go findings use the same `FlagUsage` schema with an added `language` field:

```json
{
  "language": "go",
  "provider": "launchdarkly",
  "sdk": "go-server-sdk-v7",
  "file": "services/checkout/flags.go",
  "line": 42,
  "flagKey": "checkout-v2",
  "callType": "BoolVariation",
  "isDynamic": false,
  "risk": "low",
  "fingerprint": "<stable-hash>"
}
```

The `language` field is additive. Existing TypeScript findings gain `"language": "typescript"`.
This is a minor version bump, not a breaking change (additive schema, per ADR 006 and the
product contract).

## Migration (Out of Scope Until Phase 4)

Go migration is deferred for two reasons:

1. **OpenFeature Go SDK call signatures differ non-trivially.** The Go OpenFeature client
   requires `context.Context` (Go's standard context, distinct from LaunchDarkly's
   `ldcontext.Context`), and error handling is explicit. The argument mapping is more
   complex than TypeScript.

2. **Trust must be established through audit first.** FlagLint's brand promise is that
   `--apply` can be trusted. Rushing Go migration rewrites before audit accuracy is
   proven would risk the same kind of production breakage the TypeScript scanner was
   explicitly designed to prevent.

`flaglint migrate --language go --dry-run` is Phase 4. `--apply` is Phase 5 or later.

## Phased Plan

**Phase 0 — Spike (prerequisite)**
- Validate tree-sitter-go in a Node.js/npm context (weight, CI compatibility)
- Parse one real Go file using `client.BoolVariation(...)` and confirm the AST
  node path to the flag key argument
- Document the import-tracing approach

**Phase 1 — Audit only**
- Go scanner: detect supported method calls in `.go` files
- Import tracing: identify LaunchDarkly client bindings
- `go.mod` boundary detection
- Findings flow through the existing reporter (JSON, Markdown, HTML, SARIF)
- `language` field added to JSON schema
- `--language go` filter flag added to all commands

**Phase 2 — Risk model**
- Classify findings by risk (see table above)
- Dynamic key detection for Go (variable references, `fmt.Sprintf`, string concat)
- `flaglint audit` readiness score includes Go findings

**Phase 3 — Policy and SARIF**
- Go findings work with `.flaglintpolicy.yaml` (ADR 004)
- Go rule IDs in SARIF: `flaglint.go.direct-launchdarkly`, etc.
- `flaglint validate --language go` exits 1 on Go violations
- Stable fingerprints for Go findings

**Phase 4 — Migration dry-run**
- `flaglint migrate --language go --dry-run`
- Shows before/after for statically safe calls only
- No `--apply` yet

**Phase 5 — Migration apply**
- `flaglint migrate --language go --apply`
- Only after dry-run is proven accurate across real codebases

**Phase 6 — Optional Go-native binary**
- Only if Go users request it
- `github.com/flaglint/flaglint-go` separate repository
- Must share JSON schema and SARIF contract with the npm CLI

## Consequences

- `node-tree-sitter` and `tree-sitter-go` become new production dependencies
  (contingent on spike results)
- The `src/` reorganization into `core/languages/` is deferred until Phase 1 is
  complete — do not restructure before Go scanning works end-to-end
- The `language` field is added to `FlagUsage` — additive, minor version bump
- A new ADR is required before Phase 5 (`--apply` for Go) — the migration safety
  model for Go must be approved separately, not assumed from the TypeScript model
- Docs gain a new section: Go support scope, limitations, and known patterns

## What This ADR Does Not Decide

- Which Go OpenFeature migration patterns are safe for automated rewriting (Phase 5 ADR)
- Whether a Go-native binary ships (future, demand-driven)
- Support for the LaunchDarkly Go client SDK (browser/mobile — out of scope)
- Support for any other Go feature flag provider
