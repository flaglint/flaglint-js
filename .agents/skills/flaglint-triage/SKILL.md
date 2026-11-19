---
name: flaglint-triage
description: Triage FlagLint issues, pull requests, regressions, and support reports. Use when evidence must be gathered, severity assessed, reproduction attempted, or a response drafted; not for implementing an already-understood fix.
---

# FlagLint Triage

Turn an incoming report into an evidence-backed next action.

## Workflow

1. Identify the affected command, version, platform, SDK surface, and expected behavior.
2. Reproduce with the smallest fixture possible without modifying production logic.
3. Trace the relevant source and tests, then classify the report as bug, unsupported
   pattern, documentation gap, feature request, or environment issue.
4. Assess user impact, regression risk, workaround availability, and likely ownership.
5. Draft acceptance criteria or a concise maintainer response.

## Guardrails

- Distinguish a flag scan limitation from runtime LaunchDarkly behavior.
- Do not promise support, timelines, or releases.
- Draft comments locally unless the user explicitly asks to post them.
- Do not implement the fix unless the request includes implementation.
