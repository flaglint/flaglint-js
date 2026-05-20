# Write Blog Post / Launch Copy

Voice: developer-native, sharp, no marketing fluff. Write like a senior engineer explaining a real
tool to peers — not a marketer selling a product to buyers.

Guidelines:
- Lead with the problem, not the product name
- Use concrete examples from real codebases (show actual flag key names, actual output)
- Show CLI output verbatim, not mockups
- Flag debt is the enemy. FlagLint is the shovel.
- Forbidden words: "powerful", "seamless", "robust", "easy", "simple", "game-changer"
- Use instead: specific numbers, before/after code, honest limitations

For dev.to / Show HN:
- Title must be concrete: "I built a CLI that finds dead LaunchDarkly flags in your codebase"
- First sentence: the problem in plain English
- No product pitch in the first three paragraphs
- Show `npx flaglint scan` output early
- Acknowledge what it does NOT do (no runtime evaluation, no GrowthBook/Statsig support yet)
- End with: "Open source. MIT. `npx flaglint scan .`"
