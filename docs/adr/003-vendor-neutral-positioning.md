# ADR 003 — Vendor-Neutral Positioning (No ConfigCat, GrowthBook, etc.)

Date: 2025-01
Status: ACCEPTED

## Decision
FlagLint scans LaunchDarkly only (for now) and migrates to OpenFeature only.
It does not help users migrate TO any specific vendor.

## Reasoning
- Every vendor builds tools to keep you locked in. No vendor will build the
  neutral exit ramp. That gap IS the moat.
- Adding vendor targets dilutes positioning and increases maintenance surface.
- OpenFeature is the CNCF standard — the correct abstraction target.

## Consequences
- Scanner is LD-specific in v0.1
- Migration output is OpenFeature-idiomatic, not vendor-specific
- Future: may add scanners for other vendors (Statsig, Split) but always
  migrating TO OpenFeature, never TO another proprietary vendor
