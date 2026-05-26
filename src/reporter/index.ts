import { resolve } from "path";
import { pathToFileURL } from "url";
import type { FlagUsage, ReporterOptions, ScanResult } from "../types.js";
import { isStale } from "../types.js";
import { staleReason } from "../stale.js";

declare const __PKG_VERSION__: string;

// ── helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type FlagEntry = {
  usages: FlagUsage[];
  files: Set<string>;
  callTypes: Set<string>;
  isStale: boolean;
};

function buildFlagMap(usages: FlagUsage[]): Map<string, FlagEntry> {
  const map = new Map<string, FlagEntry>();
  for (const u of usages) {
    if (!map.has(u.flagKey)) {
      map.set(u.flagKey, { usages: [], files: new Set(), callTypes: new Set(), isStale: false });
    }
    const entry = map.get(u.flagKey)!;
    entry.usages.push(u);
    entry.files.add(u.file);
    entry.callTypes.add(u.callType);
    if (isStale(u)) entry.isStale = true;
  }
  return map;
}

function sortedFlagEntries(map: Map<string, FlagEntry>): [string, FlagEntry][] {
  return [...map.entries()].sort(([, a], [, b]) => {
    if (a.isStale !== b.isStale) return a.isStale ? -1 : 1;
    return b.usages.length - a.usages.length;
  });
}

// ── markdown ─────────────────────────────────────────────────────────────────

function formatMarkdown(result: ScanResult, options: ReporterOptions): string {
  const { scannedFiles, totalUsages, uniqueFlags, usages, scanDurationMs } = result;
  const staleUsages = usages.filter((u) => isStale(u) && !u.isDynamic && u.flagKey !== "*");
  const dynamicUsages = usages.filter((u) => u.isDynamic);

  const flagMap = buildFlagMap(usages);
  const sorted = sortedFlagEntries(flagMap);
  const staleFlags = sorted.filter(([key, d]) => key !== "*" && d.isStale);

  const lines: string[] = [];

  lines.push("# FlagLint Scan Report");
  if (options.title) lines.push("", options.title);
  lines.push("");
  lines.push(`**Scanned:** ${scannedFiles} files in ${scanDurationMs}ms  `);
  lines.push(`**Flag usages:** ${totalUsages} across ${uniqueFlags.length} unique flags  `);
  lines.push(`**Stale candidates:** ${new Set(staleUsages.map((u) => u.flagKey)).size} flags flagged for review`);
  lines.push("");

  // Flag Inventory
  lines.push("## Flag Inventory");
  lines.push("| Flag Key | Usages | Files | Call Types | Status |");
  lines.push("|----------|--------|-------|------------|--------|");
  for (const [key, data] of sorted) {
    const status = data.isStale ? "⚠ Stale" : "✓ Active";
    lines.push(
      `| ${key} | ${data.usages.length} | ${data.files.size} | ${[...data.callTypes].join(", ")} | ${status} |`
    );
  }
  lines.push("");

  // Usages by File
  lines.push("## Usages by File");
  const byFile = new Map<string, FlagUsage[]>();
  for (const u of usages) {
    if (!byFile.has(u.file)) byFile.set(u.file, []);
    byFile.get(u.file)!.push(u);
  }
  for (const [file, fileUsages] of byFile) {
    lines.push(`### ${file}`);
    for (const u of [...fileUsages].sort((a, b) => a.line - b.line)) {
      lines.push(`- Line ${u.line}: \`${u.flagKey}\` (${u.callType})`);
    }
    lines.push("");
  }

  // Stale candidates
  if (staleFlags.length > 0) {
    lines.push("## ⚠ Stale Flag Candidates");
    lines.push("Flags with review signals:");
    lines.push("| Flag Key | Reason | Location |");
    lines.push("|----------|--------|----------|");
    for (const [key, data] of staleFlags) {
      const first = data.usages.find(isStale) ?? data.usages[0]!;
      lines.push(`| ${key} | ${staleReason(first)} | ${first.file}:${first.line} |`);
    }
    lines.push("");
  }

  // Dynamic keys
  if (dynamicUsages.length > 0) {
    lines.push("## Dynamic Flag Keys (Manual Review Required)");
    lines.push(
      "Flags with non-static keys that could not be automatically identified:"
    );
    for (const u of dynamicUsages) {
      lines.push(`- \`${u.flagKey}\` at ${u.file}:${u.line} — key determined at runtime`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── json ─────────────────────────────────────────────────────────────────────

function formatJSON(result: ScanResult): string {
  return JSON.stringify({ generatedAt: result.scannedAt, ...result }, null, 2);
}

// ── sarif ────────────────────────────────────────────────────────────────────

function signalRuleId(usage: FlagUsage): string {
  const signal = usage.stalenessSignals[0];
  if (!signal) return "flaglint.stale";
  return `flaglint.${signal.source}`;
}

function signalMessage(usage: FlagUsage): string {
  const reasons = usage.stalenessSignals.map((signal) => {
    switch (signal.source) {
      case "keyword":
        return `keyword "${signal.keyword}"`;
      case "path":
        return `path pattern "${signal.pattern}"`;
      case "minFileCount":
        return `file count ${signal.fileCount} <= ${signal.threshold}`;
    }
  });
  return reasons.length > 0 ? reasons.join(", ") : "staleness signal";
}

function sarifUri(file: string): string {
  return file.split(/[\\/]/).join("/");
}

function sarifRootUri(scanRoot: string): string {
  const uri = pathToFileURL(resolve(scanRoot)).href;
  return uri.endsWith("/") ? uri : `${uri}/`;
}

function formatSARIF(result: ScanResult): string {
  const staleUsages = result.usages.filter((u) => isStale(u) && !u.isDynamic && u.flagKey !== "*");
  const rules = [
    {
      id: "flaglint.keyword",
      name: "Stale flag keyword",
      shortDescription: { text: "Flag key contains a stale keyword" },
      helpUri: "https://github.com/flaglint/flaglint#what-flaglint-detects",
    },
    {
      id: "flaglint.path",
      name: "Stale flag path",
      shortDescription: { text: "Flag usage appears in a stale path" },
      helpUri: "https://github.com/flaglint/flaglint#what-flaglint-detects",
    },
    {
      id: "flaglint.minFileCount",
      name: "Low file count",
      shortDescription: { text: "Flag appears in too few files" },
      helpUri: "https://github.com/flaglint/flaglint#configuration",
    },
  ];

  return JSON.stringify(
    {
      $schema: "https://json.schemastore.org/sarif-2.1.0.json",
      version: "2.1.0",
      runs: [
        {
          tool: {
            driver: {
              name: "FlagLint",
              informationUri: "https://github.com/flaglint/flaglint",
              rules,
            },
          },
          invocations: [
            {
              executionSuccessful: true,
              startTimeUtc: result.scannedAt,
              properties: {
                scannedFiles: result.scannedFiles,
                totalUsages: result.totalUsages,
                uniqueFlags: result.uniqueFlags.length,
                scanDurationMs: result.scanDurationMs,
              },
            },
          ],
          originalUriBaseIds: {
            "%SRCROOT%": {
              uri: sarifRootUri(result.scanRoot),
            },
          },
          results: staleUsages.map((usage) => ({
            ruleId: signalRuleId(usage),
            level: "warning",
            message: {
              text: `Potentially stale feature flag "${usage.flagKey}" detected: ${signalMessage(usage)}.`,
            },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: {
                    uri: sarifUri(usage.file),
                    uriBaseId: "%SRCROOT%",
                  },
                  region: {
                    startLine: Math.max(usage.line, 1),
                    startColumn: Math.max(usage.column + 1, 1),
                  },
                },
              },
            ],
            partialFingerprints: {
              "flagKey/v1": usage.flagKey,
            },
            properties: {
              flagKey: usage.flagKey,
              callType: usage.callType,
              stalenessSignals: usage.stalenessSignals,
            },
          })),
        },
      ],
    },
    null,
    2
  );
}

// ── html ─────────────────────────────────────────────────────────────────────

/** Group usages by the first two path segments (service/directory). */
function usagesByDirectory(usages: FlagUsage[]): Map<string, FlagUsage[]> {
  const map = new Map<string, FlagUsage[]>();
  for (const u of usages) {
    const parts = u.file.replace(/\\/g, "/").split("/");
    const dir = parts.length > 1 ? parts.slice(0, Math.min(2, parts.length - 1)).join("/") : ".";
    if (!map.has(dir)) map.set(dir, []);
    map.get(dir)!.push(u);
  }
  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function formatHTML(result: ScanResult, options: ReporterOptions): string {
  const { scannedFiles, totalUsages, uniqueFlags, usages, scanDurationMs } = result;
  const staleCount = new Set(
    usages.filter((u) => isStale(u) && !u.isDynamic && u.flagKey !== "*").map((u) => u.flagKey)
  ).size;
  const dynamicCount = usages.filter((u) => u.isDynamic).length;
  const date = new Date(result.scannedAt).toLocaleString();

  // ── Audit metrics (derived from migrationInventory when available) ──────────
  const inv = result.migrationInventory ?? [];
  const automatableCount = inv.filter((i) => i.safelyAutomatable).length;
  const manualCount = inv.filter((i) => !i.safelyAutomatable).length;
  const detailBulkCount = inv.filter(
    (i) => i.manualReviewReason === "detail-method" || i.manualReviewReason === "bulk-inventory-call"
  ).length;
  const affectedFiles = new Set(usages.map((u) => u.file)).size;
  const automatablePct = inv.length > 0 ? Math.round((automatableCount / inv.length) * 100) : 0;
  const manualPct = inv.length > 0 ? Math.round((manualCount / inv.length) * 100) : 0;

  // ── Markdown summary for clipboard export ───────────────────────────────────
  const markdownSummary = [
    "## FlagLint Audit Summary",
    "",
    `- **Total call-sites:** ${totalUsages}`,
    `- **Unique flags:** ${uniqueFlags.length}`,
    `- **Files affected:** ${affectedFiles}`,
    ...(inv.length > 0
      ? [
          `- **Safely automatable:** ${automatableCount} (${automatablePct}%)`,
          `- **Manual review required:** ${manualCount} (${manualPct}%)`,
          `- **Dynamic keys:** ${dynamicCount}`,
          `- **Detail/bulk calls:** ${detailBulkCount}`,
        ]
      : [`- **Dynamic keys:** ${dynamicCount}`, `- **Stale candidates:** ${staleCount}`]),
    "",
    "### Recommended next steps",
    "1. Configure OpenFeature provider (one-time manual step)",
    "2. Review migration plan: `flaglint migrate --dry-run`",
    "3. Apply automatable transformations: `flaglint migrate --apply`",
    "4. Add CI enforcement: `flaglint validate --no-direct-launchdarkly`",
  ].join("\\n");

  const flagMap = buildFlagMap(usages);
  const sorted = sortedFlagEntries(flagMap);

  const rows = sorted
    .map(([key, data]) => {
      const cls = data.isStale ? "stale" : data.usages.some((u) => u.isDynamic) ? "dynamic" : "";
      const status = data.isStale ? "⚠ Stale" : "✓ Active";
      const fileList = [...data.files].map((f) => esc(f)).join("<br>");
      return `<tr class="${cls}"><td><code>${esc(key)}</code></td><td>${data.usages.length}</td><td>${fileList}</td><td>${[...data.callTypes].map(esc).join(", ")}</td><td>${status}</td></tr>`;
    })
    .join("\n      ");

  // ── Findings by directory ──────────────────────────────────────────────────
  const byDir = usagesByDirectory(usages);
  const dirRows = [...byDir.entries()]
    .map(([dir, dirUsages]) => {
      const flagKeys = new Set(dirUsages.map((u) => u.flagKey)).size;
      const callTypes = new Set(dirUsages.map((u) => u.callType));
      return `<tr><td><code>${esc(dir)}</code></td><td>${dirUsages.length}</td><td>${flagKeys}</td><td>${[...callTypes].map(esc).join(", ")}</td></tr>`;
    })
    .join("\n      ");

  // ── Audit summary cards (only when migrationInventory is populated) ─────────
  const auditCards = inv.length > 0
    ? `
    <div class="card"><div class="card-num green">${automatableCount}</div><div class="card-label">Auto-Migratable (${automatablePct}%)</div></div>
    <div class="card"><div class="card-num orange">${manualCount}</div><div class="card-label">Manual Review (${manualPct}%)</div></div>
    <div class="card"><div class="card-num blue">${detailBulkCount}</div><div class="card-label">Detail/Bulk Calls</div></div>`
    : "";

  const title = options.title ? esc(options.title) : "FlagLint Scan Report";
  const version = typeof __PKG_VERSION__ !== "undefined" ? __PKG_VERSION__ : "0.1.0";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    :root{--bg:#fff;--surface:#f8f9fa;--border:#dee2e6;--text:#212529;--muted:#6c757d;--stale-bg:#fef3c7;--dyn-bg:#dbeafe;--card-shadow:0 1px 3px rgba(0,0,0,.1)}
    @media(prefers-color-scheme:dark){:root{--bg:#0f172a;--surface:#1e293b;--border:#334155;--text:#e2e8f0;--muted:#94a3b8;--stale-bg:#78350f;--dyn-bg:#1e3a5f;--card-shadow:0 1px 3px rgba(0,0,0,.4)}}
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,sans-serif;padding:2rem;max-width:1200px;margin:0 auto;line-height:1.5}
    h1{font-size:1.75rem;margin-bottom:.25rem}
    h2{font-size:1.125rem;margin:2rem 0 .75rem;padding-bottom:.5rem;border-bottom:1px solid var(--border)}
    h3{font-size:.9375rem;margin:1.5rem 0 .5rem;color:var(--muted)}
    .subtitle{color:var(--muted);margin-bottom:1.5rem;font-size:.875rem}
    .cards{display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:2rem}
    .card{flex:1;min-width:140px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:1rem;box-shadow:var(--card-shadow)}
    .card-num{font-size:1.875rem;font-weight:700;line-height:1}
    .card-num.yellow{color:#d97706}
    .card-num.blue{color:#3b82f6}
    .card-num.green{color:#16a34a}
    .card-num.orange{color:#ea580c}
    .card-label{color:var(--muted);font-size:.75rem;margin-top:.375rem;text-transform:uppercase;letter-spacing:.05em}
    .filter-wrap{margin-bottom:.75rem}
    #filter{width:100%;padding:.5rem .75rem;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:.875rem;outline:none}
    #filter:focus{border-color:#6366f1}
    table{width:100%;border-collapse:collapse;font-size:.8125rem}
    th{text-align:left;padding:.625rem .75rem;background:var(--surface);border-bottom:2px solid var(--border);font-weight:600;white-space:nowrap}
    td{padding:.625rem .75rem;border-bottom:1px solid var(--border);vertical-align:top}
    tr.stale td{background:var(--stale-bg)}
    tr.dynamic td{background:var(--dyn-bg)}
    code{font-family:ui-monospace,monospace;font-size:.8em;background:var(--surface);padding:.1em .3em;border-radius:3px}
    .steps{margin:.75rem 0 1rem 1.25rem;line-height:2}
    .steps li{margin-bottom:.25rem}
    .btn{display:inline-flex;align-items:center;gap:.4rem;background:#6366f1;color:#fff;border:none;border-radius:6px;padding:.5rem 1rem;font-size:.8125rem;cursor:pointer;margin-top:.75rem}
    .btn:hover{background:#4f46e5}
    .btn.copied{background:#16a34a}
    footer{margin-top:3rem;padding-top:1rem;border-top:1px solid var(--border);color:var(--muted);font-size:.75rem;text-align:center}
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="subtitle">Scanned ${scannedFiles} files in ${scanDurationMs}ms · ${esc(date)}</p>

  <h2>Executive Summary</h2>
  <div class="cards">
    <div class="card"><div class="card-num">${totalUsages}</div><div class="card-label">Total Call-Sites</div></div>
    <div class="card"><div class="card-num">${uniqueFlags.length}</div><div class="card-label">Unique Flags</div></div>
    <div class="card"><div class="card-num">${affectedFiles}</div><div class="card-label">Files Affected</div></div>
    <div class="card"><div class="card-num yellow">${staleCount}</div><div class="card-label">Stale Candidates</div></div>
    <div class="card"><div class="card-num blue">${dynamicCount}</div><div class="card-label">Dynamic Keys</div></div>${auditCards}
  </div>

  <h2>Flag Inventory</h2>
  <div class="filter-wrap">
    <input type="text" id="filter" placeholder="Filter by flag key, file, or call type…">
  </div>
  <table id="flags-table">
    <thead><tr><th>Flag Key</th><th>Usages</th><th>Files</th><th>Call Types</th><th>Status</th></tr></thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <h2>Findings by Directory</h2>
  <table id="dir-table">
    <thead><tr><th>Directory</th><th>Call-Sites</th><th>Unique Flags</th><th>Call Types</th></tr></thead>
    <tbody>
      ${dirRows}
    </tbody>
  </table>

  <h2>Recommended Next Steps</h2>
  <ol class="steps">
    <li>Configure the OpenFeature provider once at application startup (manual — see <code>flaglint migrate --dry-run</code> for guidance)</li>
    <li>Review the migration plan: <code>flaglint migrate --dry-run</code></li>
    <li>Apply automatable transformations: <code>flaglint migrate --apply</code></li>
    <li>Add CI policy enforcement: <code>flaglint validate --no-direct-launchdarkly</code></li>
  </ol>
  <button class="btn" id="copy-btn" onclick="copyMarkdown()">📋 Copy Markdown Summary</button>

  <footer>Generated by FlagLint ${esc(version)}</footer>

  <script>
    const input = document.getElementById('filter');
    const tableRows = document.querySelectorAll('#flags-table tbody tr');
    input.addEventListener('input', () => {
      const q = input.value.toLowerCase();
      tableRows.forEach(r => { r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none'; });
    });
    function copyMarkdown() {
      const md = ${JSON.stringify(markdownSummary)}.replace(/\\\\n/g, '\\n');
      navigator.clipboard.writeText(md).then(() => {
        const btn = document.getElementById('copy-btn');
        btn.textContent = '✓ Copied!';
        btn.className = 'btn copied';
        setTimeout(() => { btn.textContent = '📋 Copy Markdown Summary'; btn.className = 'btn'; }, 2000);
      });
    }
  </script>
</body>
</html>`;
}

// ── public export ─────────────────────────────────────────────────────────────

export function formatReport(result: ScanResult, options: ReporterOptions): string {
  switch (options.format) {
    case "json":
      return formatJSON(result);
    case "html":
      return formatHTML(result, options);
    case "markdown":
      return formatMarkdown(result, options);
    case "sarif":
      return formatSARIF(result);
  }
}
