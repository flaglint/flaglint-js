#!/usr/bin/env node

const command = process.argv[2];

if (command === "scan") {
  console.log("FlagLint scan coming soon.");
  process.exit(0);
}

console.log(`
FlagLint

Feature flag debt scanner and OpenFeature migration assistant.

Usage:
  flaglint scan

Website:
  https://flaglint.dev
`);
