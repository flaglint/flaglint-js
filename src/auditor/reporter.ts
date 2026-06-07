import type { AuditReport, FlagRiskLevel } from "./index.js";
import { renderReadinessBar } from "../readiness/readiness-bar.js";
import type { MigrationEstimate } from "../estimate/estimate.js";

export interface AuditRenderOptions {
  estimate?: MigrationEstimate | null;
}

declare const __PKG_VERSION__: string;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function displayFlagKey(flag: { flagKey: string; isDynamic: boolean }): string {
  return flag.isDynamic ? "<dynamic key>" : flag.flagKey;
}

export function formatAuditJson(report: AuditReport, options?: AuditRenderOptions): string {
  const { summary, flags, readiness } = report;
  const obj: Record<string, unknown> = { summary, flags, readiness };
  if (options !== undefined) {
    obj["estimate"] = options.estimate ?? null;
  }
  return JSON.stringify(obj, null, 2);
}

export function formatAuditMarkdown(report: AuditReport, options?: AuditRenderOptions): string {
  const { summary, flags, readiness } = report;
  const lines: string[] = [];

  lines.push("# FlagLint Audit Report");
  lines.push("");
  lines.push(`**Scanned at:** ${summary.scannedAt}  `);
  lines.push(`**Scan root:** ${summary.scanRoot}  `);
  lines.push(`**Files scanned:** ${summary.scannedFiles}  `);
  lines.push(`**Duration:** ${summary.scanDurationMs}ms`);
  lines.push("");

  lines.push("## Summary");
  lines.push("");
  if (summary.lowRisk > 0) {
    lines.push("| Total Flags | High Risk | Medium Risk | Low Risk | Total Usages |");
    lines.push("|-------------|-----------|-------------|----------|--------------|");
    lines.push(
      `| ${summary.totalFlags} | ${summary.highRisk} | ${summary.mediumRisk} | ${summary.lowRisk} | ${summary.totalUsages} |`
    );
  } else {
    lines.push("| Total Flags | High Risk | Medium Risk | Total Usages |");
    lines.push("|-------------|-----------|-------------|--------------|");
    lines.push(
      `| ${summary.totalFlags} | ${summary.highRisk} | ${summary.mediumRisk} | ${summary.totalUsages} |`
    );
  }
  lines.push("");
  lines.push(
    "| Dynamic Keys | Detail Evals | Bulk Calls | Stale Signals | Safely Automatable | Manual Review |"
  );
  lines.push(
    "|--------------|--------------|------------|---------------|-------------------|---------------|"
  );
  lines.push(
    `| ${summary.dynamicKeys} | ${summary.detailEvaluations} | ${summary.bulkCalls} | ${summary.staleSignals} | ${summary.safelyAutomatable} | ${summary.manualReview} |`
  );
  lines.push("");

  lines.push("## Migration Readiness");
  lines.push("");
  if (readiness.grade === "not-applicable") {
    lines.push("Migration readiness: **N/A** — no direct LaunchDarkly calls detected.");
  } else {
    lines.push(`Migration readiness: **${readiness.score}/100** · ${readiness.grade}`);
    lines.push("");
    lines.push(renderReadinessBar(readiness.score!));
    lines.push("");
    lines.push(
      `${readiness.automatableCalls} safely automatable  ·  ${readiness.manualReviewCalls} require manual review`
    );
  }
  lines.push("");

  if (options?.estimate !== undefined) {
    const est = options.estimate;
    lines.push("## Estimated Migration Effort");
    lines.push("");
    if (est === null) {
      lines.push("N/A — no direct LaunchDarkly calls detected.");
    } else {
      lines.push("| | Low | High |");
      lines.push("|---|---|---|");
      for (const item of est.breakdown) {
        const callsLabel = item.calls > 0 ? ` (${item.calls} calls)` : "";
        lines.push(`| ${item.label}${callsLabel} | ${item.hoursLow}h | ${item.hoursHigh}h |`);
      }
      lines.push(`| **Total** | **${est.hoursLow}h** | **${est.hoursHigh}h** |`);
      lines.push("");
      if (est.costLow !== undefined && est.costHigh !== undefined) {
        const fmt = (n: number) => "$" + n.toLocaleString("en-US");
        lines.push(`Estimated cost: **${fmt(est.costLow)} – ${fmt(est.costHigh)}** (at $${est.hourlyRate}/hr)`);
        lines.push("");
      }
      lines.push(`> ${est.disclaimer}`);
      lines.push("");
      lines.push("_Assumptions: configurable planning heuristics, not observed industry benchmarks._");
    }
    lines.push("");
  }

  lines.push("## Flag Debt Inventory");
  lines.push("");
  lines.push("| Flag Key | Risk | Usages | Files | Call Types | Reasons |");
  lines.push("|----------|------|--------|-------|------------|---------|");

  const riskLabel: Record<FlagRiskLevel, string> = {
    high: "🔴 High",
    medium: "🟡 Medium",
    low: "🟢 Low",
  };

  for (const flag of flags) {
    const reasons = flag.riskReasons.join(", ") || "—";
    const flagKey = displayFlagKey(flag);
    lines.push(
      `| \`${flagKey}\` | ${riskLabel[flag.riskLevel]} | ${flag.usageCount} | ${flag.fileCount} | ${flag.callTypes.join(", ")} | ${reasons} |`
    );
  }
  lines.push("");

  lines.push("## Next Steps");
  lines.push("");
  lines.push(
    "- Run `flaglint migrate --dry-run` to preview safe OpenFeature rewrites"
  );
  lines.push(
    "- Run `flaglint validate --no-direct-launchdarkly` to enforce OF boundary in CI"
  );
  lines.push(
    "- Review HIGH risk flags manually before any automated migration"
  );
  lines.push("");

  return lines.join("\n");
}

export function formatAuditHtml(report: AuditReport, options?: AuditRenderOptions): string {
  const { summary, flags, readiness } = report;
  const version =
    typeof __PKG_VERSION__ !== "undefined" ? __PKG_VERSION__ : "0.1.0";
  const date = new Date(summary.scannedAt).toLocaleString();

  const riskBadge = (level: FlagRiskLevel): string => {
    if (level === "high")
      return '<span class="badge badge-high">High</span>';
    if (level === "medium")
      return '<span class="badge badge-medium">Medium</span>';
    return '<span class="badge badge-low">Low</span>';
  };

  const rows = flags
    .map((f) => {
      const reasons = f.riskReasons.length > 0 ? esc(f.riskReasons.join(", ")) : "—";
      const flagKey = displayFlagKey(f);
      return `<tr>
          <td><code>${esc(flagKey)}</code></td>
          <td>${riskBadge(f.riskLevel)}</td>
          <td>${f.usageCount}</td>
          <td>${f.fileCount}</td>
          <td>${f.callTypes.map(esc).join(", ")}</td>
          <td>${reasons}</td>
        </tr>`;
    })
    .join("\n        ");

  const readinessScore = readiness.score ?? 0;
  const readinessColor = readiness.grade === "not-applicable" ? "#6c757d" : readinessScore >= 80 ? "#16a34a" : readinessScore >= 50 ? "#d97706" : "#dc2626";
  const readinessFillPct = readinessScore;

  let estimateSection = "";
  if (options?.estimate !== undefined) {
    const est = options.estimate;
    if (est === null) {
      estimateSection = `
  <h2>Estimated Migration Effort</h2>
  <div class="estimate-block"><p style="color:var(--muted)">N/A — no direct LaunchDarkly calls detected.</p></div>`;
    } else {
      const fmtCost = (n: number) => "$" + n.toLocaleString("en-US");
      const costLine = est.costLow !== undefined && est.costHigh !== undefined
        ? `<div class="estimate-cost">${fmtCost(est.costLow)} – ${fmtCost(est.costHigh)} <span style="font-weight:400;font-size:.8em">at $${est.hourlyRate}/hr</span></div>`
        : "";
      const bRows = est.breakdown.map(item => {
        const callsLabel = item.calls > 0 ? ` <span style="color:var(--muted);font-size:.85em">(${item.calls} calls)</span>` : "";
        return `<tr><td>${esc(item.label)}${callsLabel}</td><td>${item.hoursLow}h</td><td>${item.hoursHigh}h</td><td style="color:var(--muted);font-size:.8em">${esc(item.basis)}</td></tr>`;
      }).join("\n        ");
      const { assumptions } = est;
      estimateSection = `
  <h2>Estimated Migration Effort</h2>
  <div class="estimate-block">
    <div class="estimate-total">${est.hoursLow}h – ${est.hoursHigh}h</div>
    ${costLine}
    <table style="margin-top:.75rem">
      <thead><tr><th>Work Item</th><th>Low</th><th>High</th><th>Basis</th></tr></thead>
      <tbody>
        ${bRows}
      </tbody>
    </table>
    <details style="margin-top:.75rem;font-size:.8125rem">
      <summary style="cursor:pointer;color:var(--muted);user-select:none">Estimation assumptions</summary>
      <table style="margin-top:.5rem">
        <thead><tr><th>Parameter</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>Automatable call</td><td>${assumptions.automationHoursPerCall}h</td></tr>
          <tr><td>Manual-review call</td><td>${assumptions.manualReviewHoursPerCall}h</td></tr>
          <tr><td>Validation</td><td>${assumptions.validationMultiplier * 100}% of migration work</td></tr>
          <tr><td>Minimum estimate</td><td>${assumptions.minimumHours}h</td></tr>
        </tbody>
      </table>
      <p style="margin-top:.5rem;color:var(--muted)">These are configurable planning heuristics, not observed industry benchmarks.</p>
    </details>
    <p class="estimate-disclaimer">${esc(est.disclaimer)}</p>
  </div>`;
    }
  }

  const breakdownRows = readiness.manualReviewBreakdown
    .map(
      (d) =>
        `<tr><td>${esc(d.label)}</td><td>${d.count}</td><td style="color:var(--muted);font-size:.8em">${esc(d.explanation)}</td></tr>`
    )
    .join("\n        ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FlagLint Audit Report</title>
  <style>
    :root{--bg:#fff;--surface:#f8f9fa;--border:#dee2e6;--text:#212529;--muted:#6c757d;--card-shadow:0 1px 3px rgba(0,0,0,.1)}
    @media(prefers-color-scheme:dark){:root{--bg:#0f172a;--surface:#1e293b;--border:#334155;--text:#e2e8f0;--muted:#94a3b8;--card-shadow:0 1px 3px rgba(0,0,0,.4)}}
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,sans-serif;padding:2rem;max-width:1200px;margin:0 auto;line-height:1.5}
    h1{font-size:1.75rem;margin-bottom:.25rem}
    h2{font-size:1.125rem;margin:2rem 0 .75rem;padding-bottom:.5rem;border-bottom:1px solid var(--border)}
    .subtitle{color:var(--muted);margin-bottom:1.5rem;font-size:.875rem}
    .cards{display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:2rem}
    .card{flex:1;min-width:140px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:1rem;box-shadow:var(--card-shadow)}
    .card-num{font-size:1.875rem;font-weight:700;line-height:1}
    .card-num.red{color:#dc2626}
    .card-num.amber{color:#d97706}
    .card-num.green{color:#16a34a}
    .card-num.blue{color:#3b82f6}
    .card-num.purple{color:#7c3aed}
    .card-num.orange{color:#ea580c}
    .card-label{color:var(--muted);font-size:.75rem;margin-top:.375rem;text-transform:uppercase;letter-spacing:.05em}
    .readiness-block{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:1.25rem;margin-bottom:1.5rem}
    .readiness-score-line{display:flex;align-items:baseline;gap:.75rem;margin-bottom:.75rem}
    .readiness-score-num{font-size:2.5rem;font-weight:700;line-height:1}
    .readiness-grade{font-size:.875rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
    .readiness-bar-track{height:12px;background:var(--border);border-radius:6px;overflow:hidden;margin-bottom:.75rem}
    .readiness-bar-fill{height:100%;border-radius:6px;transition:width .3s}
    .readiness-stats{display:flex;gap:2rem;font-size:.875rem;color:var(--muted);flex-wrap:wrap}
    .readiness-norm{margin-top:.5rem;font-size:.8em;color:var(--muted)}
    table{width:100%;border-collapse:collapse;font-size:.8125rem}
    th{text-align:left;padding:.625rem .75rem;background:var(--surface);border-bottom:2px solid var(--border);font-weight:600;white-space:nowrap}
    td{padding:.625rem .75rem;border-bottom:1px solid var(--border);vertical-align:top}
    code{font-family:ui-monospace,monospace;font-size:.8em;background:var(--surface);padding:.1em .3em;border-radius:3px}
    .badge{display:inline-block;padding:.2em .6em;border-radius:4px;font-size:.75rem;font-weight:600}
    .badge-high{background:#fee2e2;color:#991b1b}
    .badge-medium{background:#fef3c7;color:#92400e}
    .badge-low{background:#dcfce7;color:#166534}
    @media(prefers-color-scheme:dark){
      .badge-high{background:#7f1d1d;color:#fca5a5}
      .badge-medium{background:#78350f;color:#fcd34d}
      .badge-low{background:#14532d;color:#86efac}
    }
    .estimate-block{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:1.25rem;margin-bottom:1.5rem}
    .estimate-total{font-size:1.5rem;font-weight:700;margin-bottom:.75rem}
    .estimate-cost{font-size:1rem;font-weight:600;margin:.75rem 0;color:#3b82f6}
    .estimate-disclaimer{margin-top:.75rem;font-size:.75rem;color:var(--muted);font-style:italic}
    .steps{margin:.75rem 0 1rem 1.25rem;line-height:2}
    footer{margin-top:3rem;padding-top:1rem;border-top:1px solid var(--border);color:var(--muted);font-size:.75rem;text-align:center}
    footer a{color:var(--muted)}
  </style>
</head>
<body>
  <h1>FlagLint Audit Report</h1>
  <p class="subtitle">
    ${esc(summary.scanRoot)} &middot; ${esc(summary.scannedFiles.toString())} files &middot; ${esc(summary.scanDurationMs.toString())}ms &middot; ${esc(date)}
  </p>

  <h2>Summary</h2>
  <div class="cards">
    <div class="card"><div class="card-num">${summary.totalFlags}</div><div class="card-label">Total Flags</div></div>
    <div class="card"><div class="card-num red">${summary.highRisk}</div><div class="card-label">High Risk</div></div>
    <div class="card"><div class="card-num amber">${summary.mediumRisk}</div><div class="card-label">Medium Risk</div></div>
    ${summary.lowRisk > 0 ? `<div class="card"><div class="card-num green">${summary.lowRisk}</div><div class="card-label">Low Risk</div></div>` : ""}
    <div class="card"><div class="card-num purple">${summary.safelyAutomatable}</div><div class="card-label">Safely Automatable</div></div>
    <div class="card"><div class="card-num orange">${summary.manualReview}</div><div class="card-label">Manual Review</div></div>
  </div>

  <h2>Migration Readiness</h2>
  <div class="readiness-block">
    ${readiness.grade === "not-applicable" ? `
    <div class="readiness-stats">N/A — no direct LaunchDarkly calls detected.</div>` : `
    <div class="readiness-score-line">
      <span class="readiness-score-num" style="color:${readinessColor}">${readinessScore}</span>
      <span style="color:var(--muted);font-size:1.25rem">/100</span>
      <span class="readiness-grade" style="color:${readinessColor}">${readiness.grade}</span>
    </div>
    <div class="readiness-bar-track">
      <div class="readiness-bar-fill" style="width:${readinessFillPct}%;background:${readinessColor}"></div>
    </div>
    <div class="readiness-stats">
      <span>${readiness.automatableCalls} safely automatable</span>
      <span>${readiness.manualReviewCalls} require manual review</span>
      <span>${readiness.totalCalls} total calls</span>
    </div>
    ${readiness.manualReviewBreakdown.length > 0 ? `
    <table style="margin-top:1rem">
      <thead><tr><th>Issue</th><th>Occurrences</th><th>Explanation</th></tr></thead>
      <tbody>
        ${breakdownRows}
      </tbody>
    </table>` : ""}`}
  </div>
  ${estimateSection}

  <h2>Flag Debt Inventory</h2>
  <table>
    <thead>
      <tr>
        <th>Flag Key</th>
        <th>Risk</th>
        <th>Usages</th>
        <th>Files</th>
        <th>Call Types</th>
        <th>Risk Reasons</th>
      </tr>
    </thead>
    <tbody>
        ${rows}
    </tbody>
  </table>

  <h2>Next Steps</h2>
  <ol class="steps">
    <li>Run <code>flaglint migrate --dry-run</code> to preview safe OpenFeature rewrites</li>
    <li>Run <code>flaglint validate --no-direct-launchdarkly</code> to enforce OF boundary in CI</li>
    <li>Review HIGH risk flags manually before any automated migration</li>
  </ol>

  <footer>
    Generated by <a href="https://flaglint.dev">FlagLint</a> ${esc(version)}
  </footer>
</body>
</html>`;
}
