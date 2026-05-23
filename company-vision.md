# Company.vision.md — FlagLint / Runtime Logic Labs LLC
**Strategic Operating Plan: Q2 2026 → Q1 2028**
Owner: Founder/CEO · Drafted with C-suite hat on (CEO/CTO/CFO/Growth)
Last updated: May 21, 2026
Status: Live — review monthly, revise quarterly

> Note: This complements `VISION.md` (the gitignored CEO vision doc) and `MEMORY.md` (the append-only decisions log). This file is the *operating plan* — what we do, when, and why. Decisions get logged in MEMORY.md as always.

---

## 0. The One Thing

If you read nothing else: **the product is no longer the bottleneck. Distribution is.**
You have shipped a real, working CLI. v0.1.5 is live on npm. The site is up. CI is green.
You have **zero users and zero revenue.** Every hour spent on more code before you have users is a defensive crouch. The next 60 days are about getting in front of developers, not writing TypeScript.

The plan below is built around that single truth.

---

## 1. The Strategic Thesis (Why This, Why Now)

**The bet:** OpenFeature (CNCF) is becoming the standard for feature flagging, but it has almost no adoption tooling. There's no "get started" story, no migration path, no observability layer. FlagLint becomes the **intelligence and tooling layer for the OpenFeature era** — first as a free CLI, then as a hosted backend.

**Why the window is open now:**
- OpenFeature is past the hype phase and into real adoption — but the tooling ecosystem is empty.
- LaunchDarkly's MAU-based pricing is creating real pain at exactly the moment a credible open standard exists.
- Feature flags are universal — every software team has them, most manage them badly.

**Why AI changes the urgency (the honest version):**
AI cuts both ways and you need to internalize this:
- **For you:** A solo founder can now ship at the speed of a 5-person team. The $100/mo Claude budget is justified — it's the cheapest leverage you'll ever buy. Use it.
- **Against you:** The same AI means a competitor can clone your CLI in a weekend. **Your code is not a moat.** Anyone can prompt their way to an AST scanner now.

**Therefore the real moat is NOT the scanner.** It's three things, in order of durability:
1. **Data** — once you host flags, you see usage patterns nobody else can. This compounds and cannot be cloned.
2. **Distribution / audience** — a list of 2,000 engineers who trust you and an OSS project with 1,000 stars is something a competitor has to spend a year building.
3. **OpenFeature-native positioning** — being the first credible "OpenFeature-first" backend is a brand position you can own before incumbents retrofit.

The strategy below is engineered to build all three before competition arrives.

---

## 2. Competitive Reality Check (No Illusions)

| Threat | Real? | Our answer |
|---|---|---|
| LaunchDarkly builds a free migration tool | Low — they won't help you leave | If they do, it proves the market. We're vendor-neutral; they can't be. |
| Flagsmith / GrowthBook / Unleash add scanning | Medium | They're backends, not intelligence layers. We integrate, not compete (until v0.3). |
| A funded startup clones FlagLint | High over 12 months | Speed + audience + data moat. Win the OSS mindshare first. |
| AI-native dev tools commoditize scanning | High | Move up the stack fast: from scanning → managing → analytics. Don't get stuck as "a linter." |

**Brutal truth:** the scanner alone is a feature, not a company. The company is the hosted flag platform. The scanner is the wedge that earns the right to build it.

---

## 3. THE 60-DAY SPRINT (Detailed — This Is What Matters Most)

Goal of the next 8 weeks: **100+ real CLI users, 200+ waitlist signups, 1 paid consulting engagement, 500+ GitHub stars.** If you hit that, you've validated the wedge. If you don't, you learn what's wrong before building cloud.

### Week 1 — Polish + Launch Prep
- [ ] Fix landing page version (still says v0.1.2 → v0.1.5)
- [ ] Fix `engines: node >=22` → `>=18` (you're locking out enterprise Node 18/20 users) **OR** correct the README claim. Pick one.
- [ ] Fix `twitter:site` meta tag: `@flaglint` → `@flaglintdev`
- [ ] Add GitHub repo topics: `feature-flags launchdarkly openfeature cli typescript developer-tools`
- [ ] Seed 4 real GitHub issues (Go/Python SDK support, client-side SDK fix, date-based staleness, multi-provider) — an empty Issues tab looks dead
- [ ] Check who forked the repo — that's a warm lead, message them
- [ ] Record a 60-second terminal demo (asciinema or a clean GIF) — put it at the top of the README and the landing page. **This is the single highest-converting asset for a CLI.**

### Week 2 — The Show HN Launch
- [ ] Write the Show HN post (I'll draft it — title: "Show HN: FlagLint – Find stale LaunchDarkly flags and plan your OpenFeature migration")
- [ ] Launch Tue–Thu, 8–10am ET (peak HN traffic)
- [ ] Be at your keyboard ALL DAY to answer every comment within minutes — engagement velocity drives ranking
- [ ] Cross-post to r/javascript, r/node, r/devops, Lobsters
- [ ] Have the dev.to deep-dive ready to drop the same week ("How I built an AST-based scanner for feature flag debt")

### Week 3 — Convert Attention to Relationships
- [ ] 30 LinkedIn DMs to engineers/EMs at companies known to use LaunchDarkly (Series B–D SaaS especially)
- [ ] The DM is NOT a pitch. It's: "Built a free tool that finds stale LD flags — mind if I run it on a repo and send you the report? No strings." This is how consulting deals start.
- [ ] 3 Twitter/X threads: (1) the real cost of flag debt, (2) LD pricing breakdown, (3) why OpenFeature wins
- [ ] Submit to: OpenFeature community Slack, CNCF tooling lists, awesome-feature-flags GitHub lists

### Week 4 — First Revenue Signal
- [ ] Anyone engaged who runs an LD-heavy shop → offer the **$10K 2-week migration audit**. Even one closes = your first real money + your first case study.
- [ ] Stand up a simple "FlagLint Cloud waitlist → book a call" funnel
- [ ] Write a "what I learned from the launch" retro post (more reach, more credibility)

### Weeks 5–8 — Compound + Decide
- [ ] Ship v0.2 based on launch feedback (the client-side SDK fix is the #1 known gap)
- [ ] Add Go and/or Python SDK detection if launch feedback demands it (it likely will — JS-only is limiting)
- [ ] Publish a second technical post + a second thread cadence
- [ ] **Decision gate (end of Week 8):** Did you hit ~100 users / 200 signups / 1 paid deal? → proceed to cloud. If not → diagnose: is it discovery, is it the product, is it the market? Do not build cloud blind.

**Your time budget during this sprint:** You're still at Fidelity. Realistically you have ~15–20 hrs/week. Spend **70% on distribution, 30% on code.** This will feel wrong because code is comfortable and DMs are uncomfortable. Do the uncomfortable thing.

---

## 4. THE 2-YEAR QUARTERLY ROADMAP

Realistic, staged, with kill/proceed gates. Every quarter has a primary metric. If you miss it badly two quarters running, you re-plan — you don't grind a dead path.

### Q2 2026 (now → Jun) — VALIDATE THE WEDGE
- **Primary metric:** 100 CLI users, 1 paid consulting deal
- Ship the 60-day sprint above
- Incorporate Runtime Logic Labs LLC (you keep deferring this — do it before money changes hands)
- **Gate:** real usage signal → continue. Crickets → diagnose before building anything new.

### Q3 2026 (Jul–Sep) — BUILD THE PAID WEDGE (Cloud v1: Read-Only)
- **Primary metric:** $1K MRR, 10 paying accounts
- Ship `flaglint scan --cloud` → posts results to your API
- `app.flaglint.dev` dashboard: scan history, flag-debt-over-time, top stale flags
- Stack: Cloudflare Workers + D1 (or Turso) + small React dashboard. ~$20/mo infra.
- Pricing live: **Starter $49/mo** (1 repo, 30-day history, Slack alert)
- This is the "will they pay at all" test. Cheap to build, fast to ship with AI.

### Q4 2026 (Oct–Dec) — BECOME THE BACKEND (Cloud v2)
- **Primary metric:** $4K MRR, 25 paying accounts
- Ship the **OpenFeature-native flag backend** — you now host and evaluate flags
- Endpoints: create/update flag, evaluate flag for context, list, analytics
- Edge caching (Upstash Redis) for sub-10ms eval
- Pricing: **Cloud $149/mo** (FlagLint manages your flags) unlocks
- This is the strategic pivot from "tool" to "platform." The data moat starts compounding here.
- **Gate:** if Starter tier got <10 paying accounts in Q3, do NOT build the backend yet — fix the wedge first.

### Q1 2027 (Jan–Mar) — ANALYTICS = THE KILLER FEATURE
- **Primary metric:** $8K MRR, 40 accounts
- Ship **real-usage staleness**: not heuristics — actual flag eval volume tells you what's dead. Nobody else has this because nobody else has the eval data.
- GitHub PR comments, Slack digests, multi-repo aggregation
- Pricing: **Teams $499/mo** (unlimited repos, SSO-lite, audit log)
- Begin SOC 2 Type II prep (you'll need it for enterprise within 12 months)

### Q2 2027 (Apr–Jun) — THE "ADOPT" MARKET (10x the TAM)
- **Primary metric:** $15K MRR, 70 accounts
- Ship `flaglint adopt` — finds hidden flags (env vars, config booleans) in teams NOT on LaunchDarkly
- This opens you to *every* software team, not just LD escapees
- Reposition: "the on-ramp to OpenFeature, whether you're escaping LD or starting fresh"
- Small companies enter at Cloud $149 and grow up

### Q3 2027 (Jul–Sep) — DECISION POINT: STAY OR SCALE
- **Primary metric:** $25K MRR, 100+ accounts
- **This is the fork in the road.** Two honest paths:
  - **(A) Raise:** ~$25K+ MRR + clear growth = raise a $1.5–2.5M seed from a dev-tools fund (Boldstart, Heavybit, Decibel). Go full-time. Hire 1–2 engineers.
  - **(B) Stay lean:** Strong but slower = keep it as a profitable solo/duo business at Fidelity, target $300–500K/yr distributable. Genuinely fine outcome.
- Complete SOC 2. Land first 2–3 enterprise contracts ($2K+/mo).

### Q4 2027 (Oct–Dec) — ENTERPRISE + DEPTH
- **Primary metric:** $40K MRR
- Enterprise tier ($2K+/mo): SLA, SSO, on-prem option, dedicated support
- AI-native feature: "flag debt copilot" — auto-generates cleanup PRs for dead flags. THIS is where your $100/mo Claude budget becomes a product feature, not just a dev tool.

### Q1 2028 (Jan–Mar) — $50K+ MRR / DECIDE ON FIDELITY
- **Primary metric:** $50K MRR, clear path to $100K
- At ~$50K MRR with healthy growth and (if path A) a closed round, **this is when leaving Fidelity becomes a defensible decision** — not before.
- **Honest note:** your stated $100K MRR target to leave is more likely a *late-2028 / 2029* reality than a 2-year one. Plan for the journey, not the fantasy timeline.

---

## 5. Financial Model (Realistic — Read This Twice)

These are *base-case* numbers for a solo founder going part-time → full-time. Not the pitch-deck hockey stick.

| Quarter | MRR (target) | Paying accts | Cumulative one-time (consulting) |
|---|---|---|---|
| Q2 '26 | $0 | 0 | $0–10K |
| Q3 '26 | $1K | 10 | $10–20K |
| Q4 '26 | $4K | 25 | $20–30K |
| Q1 '27 | $8K | 40 | $30–45K |
| Q2 '27 | $15K | 70 | — |
| Q3 '27 | $25K | 100 | — |
| Q4 '27 | $40K | ~150 | — |
| Q1 '28 | $50K+ | ~200 | — |

**Costs (monthly, scaling):**
- Now: Claude $100 + domain/infra ~$20 + Loops free tier = **~$130/mo**
- Q4 '26 (backend live): + Cloudflare/Turso/Upstash ~$50–150 = **~$300/mo**
- Q3 '27: + SOC 2 (~$15–20K one-time over 6 mo) + tooling = **~$2–3K/mo run-rate**

**The $100/mo Claude spend is correct.** It's your cheapest engineer. Approve it without second-guessing. The leverage on a solo founder is enormous — it's the difference between shipping the cloud backend in 6 weeks vs 6 months.

**Truthful caveat on conversion:** dev-tool free→paid conversion is brutal (often 1–3%). To get 200 paying accounts you likely need 10,000+ active CLI users. That's why the OSS distribution work in Q2–Q3 is do-or-die. The funnel math only works if the top of the funnel is huge.

---

## 6. Team / Hiring Plan

- **Now → Q2 '27:** You + wife (business/ops) + Claude. No hires. Stay capital-efficient.
- **Q3 '27 (if path A):** First hire = a backend/infra engineer (reliability becomes your problem once you host flags). Second = a DevRel/content person (distribution doesn't scale on one founder).
- **Do NOT hire before $20K MRR.** Premature hiring kills more bootstrapped startups than competition does.

---

## 7. The AI Strategy (Explicit, Because You Asked)

1. **AI as your dev team:** $100/mo Claude. Use Claude Code in the terminal for all building. This chat for strategy/architecture. Ship at 5x speed.
2. **AI as a product feature (Q4 '27):** the "flag debt copilot" that auto-writes cleanup PRs. This is genuinely differentiated and only possible because you'll own the eval data.
3. **AI as a moat threat:** assume any competitor can clone your CLI. Race them to the data layer (hosted flags) where AI can't shortcut the moat. **This is why you don't linger on the scanner.**

---

## 8. Top Risks (and Mitigations)

| Risk | Severity | Mitigation |
|---|---|---|
| You build, nobody comes | **Highest** | 60-day distribution sprint. Decision gate at week 8. |
| You stay in code-comfort, avoid sales/DMs | High | This is the #1 founder failure mode. The plan forces 70% distribution. Hold yourself to it. |
| Fidelity employment-agreement / IP conflict | Medium | (You've said don't relitigate — but: LLC + clean separation + the consulting/SaaS being clearly outside-employment is worth a one-time attorney check before first revenue.) |
| Hosting flags = reliability burden | Medium | Cloudflare's edge model + don't host until 25+ paying accounts demand it. |
| Burnout (full-time job + startup) | Medium | The quarterly gates exist so you don't grind a dead path. Protect the marriage and the day job — both fund this. |

---

## 9. What You Missed (Additions)

Things not in your current context doc that belong in the plan:

1. **A demo GIF/asciinema** — the single highest-leverage marketing asset for a CLI, and you don't have one. Week 1.
2. **Go and Python SDK detection** — JS/TS only caps your market hard. LaunchDarkly's biggest spenders are often polyglot backends. Roadmap it for v0.2/v0.3 based on launch feedback.
3. **A "design partner" program** — recruit 3–5 teams who use the CLI and will co-build the cloud with you in exchange for free/discounted early access. They become case studies + your product roadmap.
4. **GitHub Sponsors + a "used by" wall** — social proof is your cheapest growth lever once you have a few logos.
5. **An explicit kill criterion** — written down so you don't romanticize a dead path: *if by Q1 2027 you're under $3K MRR with flat growth, FlagLint stays a profitable side project / portfolio piece and you do NOT quit Fidelity for it.* Naming this in advance protects you from a bad emotional decision later.
6. **OpenFeature community standing** — get involved in the CNCF OpenFeature project itself (contribute, show up in Slack, maybe a small PR). Being a known name in that community is distribution + credibility that compounds.

---

## 10. The Honest Bottom Line

You've done the hard technical part. That part is *done well.* The reason most projects like this die is not the code — it's that the founder keeps polishing the code because shipping it to strangers is scary.

For the next 60 days, your job is not "engineer." It's "founder who happens to engineer." Talk to humans. Post the launch. Send the DMs. Run free audits. Let the market tell you what to build next instead of guessing in the editor.

The platform vision (hosted flags, analytics, AI copilot) is real and worth a multi-million-dollar outcome over 3–5 years. But it only unlocks if the wedge works first. Win the wedge. Everything else follows.

**Next action:** ship the Week 1 fixes, then launch on HN. Want the Show HN post drafted now?