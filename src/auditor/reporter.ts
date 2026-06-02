import type { AuditReport, FlagRiskLevel } from "./index.js";

declare const __PKG_VERSION__: string;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatAuditJson(report: AuditReport): string {
  return JSON.stringify(report, null, 2);
}

export function formatAuditMarkdown(report: AuditReport): string {
  const { summary, flags } = report;
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
  lines.push("| Total Flags | High Risk | Medium Risk | Low Risk | Total Usages |");
  lines.push("|-------------|-----------|-------------|----------|--------------|");
  lines.push(
    `| ${summary.totalFlags} | ${summary.highRisk} | ${summary.mediumRisk} | ${summary.lowRisk} | ${summary.totalUsages} |`
  );
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
    lines.push(
      `| \`${flag.flagKey}\` | ${riskLabel[flag.riskLevel]} | ${flag.usageCount} | ${flag.fileCount} | ${flag.callTypes.join(", ")} | ${reasons} |`
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

export function formatAuditHtml(report: AuditReport): string {
  const { summary, flags } = report;
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
      return `<tr>
          <td><code>${esc(f.flagKey)}</code></td>
          <td>${riskBadge(f.riskLevel)}</td>
          <td>${f.usageCount}</td>
          <td>${f.fileCount}</td>
          <td>${f.callTypes.map(esc).join(", ")}</td>
          <td>${reasons}</td>
        </tr>`;
    })
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
    <div class="card"><div class="card-num green">${summary.lowRisk}</div><div class="card-label">Low Risk</div></div>
    <div class="card"><div class="card-num purple">${summary.safelyAutomatable}</div><div class="card-label">Safely Automatable</div></div>
    <div class="card"><div class="card-num orange">${summary.manualReview}</div><div class="card-label">Manual Review</div></div>
  </div>

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
