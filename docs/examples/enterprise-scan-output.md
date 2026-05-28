# Generated enterprise scan output

Generated with:

```bash
node ./dist/bin/flaglint.js scan ./examples/enterprise-checkout-service/src --config ./examples/enterprise-checkout-service/.flaglintrc --format markdown
```

```text
- Scanning ./examples/enterprise-checkout-service/src...
✓ 20 flag usages found across 11 unique flags (90ms)
ℹ  1 dynamic flag key(s) require manual review
# FlagLint Scan Report

Enterprise Checkout Service — Flag Inventory

**Scanned:** 5 files in 90ms
**Flag usages:** 20 across 11 unique flags
**Stale candidates:** 0 flags flagged for review

## Usages by File
### checkout.ts
- Line 40: `checkout-v2` (boolVariation)
- Line 49: `payment-provider` (stringVariation)
- Line 58: `one-click-checkout` (boolVariation)
- Line 67: `checkout-currency` (stringVariation)
```
