# FlagLint: LaunchDarkly to OpenFeature

Safely rewrites proven LaunchDarkly Node.js server SDK evaluations to an
existing OpenFeature client. It shares the migration planner and safety rules
used by `flaglint migrate --apply`.

## Run

From the repository you want to migrate:

```bash
npx codemod @flaglint/launchdarkly-to-openfeature
```

The command follows the current Codemod registry CLI syntax. Review the diff
before committing it.

## What changes

The codemod rewrites a call only when all safety proofs succeed:

- the LaunchDarkly client comes from `launchdarkly-node-server-sdk` or
  `@launchdarkly/node-server-sdk`;
- the flag key is static;
- the fallback value has a known boolean, string, number, or object type; and
- the file has exactly one verified OpenFeature client binding.

For example:

```ts
const enabled = await ldClient.boolVariation("checkout-v2", context, false);
```

becomes:

```ts
const enabled = await openFeatureClient.getBooleanValue(
  "checkout-v2",
  false,
  context,
);
```

Dynamic keys, `*VariationDetail` calls, unknown fallback types,
`allFlags`/`allFlagsState`, and files without a verified OpenFeature client
remain unchanged. Run `npx flaglint migrate --dry-run` for the manual-review
inventory and provider setup guidance.

The transform supports JavaScript, JSX, TypeScript, and TSX. It runs locally
and does not require a LaunchDarkly API key.

Project-specific `.flaglintrc` wrapper and imported-client configuration is
handled by the FlagLint CLI, not this initial registry package. Use
`npx flaglint migrate --apply` for those configured proof rules.

## Develop locally

```bash
# From the flaglint-js repository root:
npm run build:codemod
npm run test:codemod

# Run the package against another local project:
npx codemod@1.18.7 workflow run \
  -w ./codemods/launchdarkly-to-openfeature \
  -t /path/to/project
```

## License

MIT
