# FlagLint Scan Report

Enterprise Checkout Service — Flag Inventory

**Scanned:** 5 files
**Flag usages:** 20 across 11 unique flags
**Stale candidates:** 0 flags flagged for review

## Flag Inventory
| Flag Key | Usages | Files | Call Types | Status |
|----------|--------|-------|------------|--------|
| dynamic | 8 | 3 | variationDetail, boolVariation, stringVariation, numberVariation, jsonVariation, variation | ✓ Active |
| checkout-experiment | 1 | 1 | boolVariationDetail | ✓ Active |
| * | 1 | 1 | allFlagsState | ✓ Active |
| checkout-v2 | 1 | 1 | boolVariation | ✓ Active |
| payment-provider | 1 | 1 | stringVariation | ✓ Active |
| one-click-checkout | 1 | 1 | boolVariation | ✓ Active |
| checkout-currency | 1 | 1 | stringVariation | ✓ Active |
| discount-percentage | 1 | 1 | numberVariation | ✓ Active |
| max-discount-amount | 1 | 1 | numberVariation | ✓ Active |
| discount-config | 1 | 1 | jsonVariation | ✓ Active |
| pricing-tier-config | 1 | 1 | jsonVariation | ✓ Active |
| recommendations-variant | 1 | 1 | stringVariation | ✓ Active |
| bulk-discount-enabled | 1 | 1 | boolVariation | ✓ Active |

## Usages by File
### analytics.ts
- Line 51: `dynamic` (variationDetail)
- Line 76: `checkout-experiment` (boolVariationDetail)
- Line 104: `*` (allFlagsState)

### checkout.ts
- Line 40: `checkout-v2` (boolVariation)
- Line 49: `payment-provider` (stringVariation)
- Line 58: `one-click-checkout` (boolVariation)
- Line 67: `checkout-currency` (stringVariation)

### flags-wrapper.ts
- Line 48: `dynamic` (boolVariation)
- Line 67: `dynamic` (boolVariation)
- Line 70: `dynamic` (stringVariation)
- Line 73: `dynamic` (numberVariation)
- Line 75: `dynamic` (jsonVariation)
- Line 86: `dynamic` (variation)

### pricing.ts
- Line 46: `discount-percentage` (numberVariation)
- Line 55: `max-discount-amount` (numberVariation)
- Line 69: `discount-config` (jsonVariation)
- Line 83: `pricing-tier-config` (jsonVariation)

### product.ts
- Line 52: `dynamic` (boolVariation)
- Line 61: `recommendations-variant` (stringVariation)
- Line 70: `bulk-discount-enabled` (boolVariation)

## Dynamic Flag Keys (Manual Review Required)
Flags with non-static keys that could not be automatically identified:
- `dynamic` at analytics.ts:51 — key determined at runtime
- `dynamic` at flags-wrapper.ts:48 — key determined at runtime
- `dynamic` at flags-wrapper.ts:67 — key determined at runtime
- `dynamic` at flags-wrapper.ts:70 — key determined at runtime
- `dynamic` at flags-wrapper.ts:73 — key determined at runtime
- `dynamic` at flags-wrapper.ts:75 — key determined at runtime
- `dynamic` at flags-wrapper.ts:86 — key determined at runtime
- `dynamic` at product.ts:52 — key determined at runtime
