import type { FlagUsage, ReporterOptions, ScanResult } from "../types.js";

declare const __PKG_VERSION__: string;

// ── helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function staleReason(u: FlagUsage): string {
  if (/\.(test|spec|mock)\.[jt]sx?$/.test(u.file)) return "Located in test file";
  if (/\/deprecated\/|\/old\/|\/legacy\//.test(u.file)) return "Located in deprecated path";
  const kw = ["old", "deprecated", "legacy", "temp", "tmp", "test", "demo"].find((k) =>
    u.flagKey.toLowerCase().includes(k)
  );
  return kw ? `Contains "${kw}" in key` : "Flagged as stale";
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
    if (u.isStale) entry.isStale = true;
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
  const staleUsages = usages.filter((u) => u.isStale);
  const dynamicUsages = usages.filter((u) => u.isDynamic);

  const flagMap = buildFlagMap(usages);
  const sorted = sortedFlagEntries(flagMap);
  const staleFlags = sorted.filter(([, d]) => d.isStale);

  const lines: string[] = [];

  lines.push("# FlagLint Scan Report");
  if (options.title) lines.push("", options.title);
  lines.push("");
  lines.push(`**Scanned:** ${scannedFiles} files in ${scanDurationMs}ms  `);
  lines.push(`**Flag usages:** ${totalUsages} across ${uniqueFlags.length} unique flags  `);
  lines.push(`**Stale candidates:** ${staleUsages.length} flags flagged for review`);
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
    lines.push("Flags that may be safe to remove:");
    lines.push("| Flag Key | Reason | Location |");
    lines.push("|----------|--------|----------|");
    for (const [key, data] of staleFlags) {
      const first = data.usages[0]!;
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
      lines.push(`- \`dynamic\` at ${u.file}:${u.line} — key determined at runtime`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── json ─────────────────────────────────────────────────────────────────────

function formatJSON(result: ScanResult): string {
  return JSON.stringify({ generatedAt: new Date().toISOString(), ...result }, null, 2);
}

// ── html ─────────────────────────────────────────────────────────────────────

function formatHTML(result: ScanResult, options: ReporterOptions): string {
  const { scannedFiles, totalUsages, uniqueFlags, usages, scanDurationMs } = result;
  const staleCount = usages.filter((u) => u.isStale).length;
  const dynamicCount = usages.filter((u) => u.isDynamic).length;
  const date = new Date().toLocaleString();

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
    .subtitle{color:var(--muted);margin-bottom:1.5rem;font-size:.875rem}
    .cards{display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:2rem}
    .card{flex:1;min-width:140px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:1rem;box-shadow:var(--card-shadow)}
    .card-num{font-size:1.875rem;font-weight:700;line-height:1}
    .card-num.yellow{color:#d97706}
    .card-num.blue{color:#3b82f6}
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
    footer{margin-top:3rem;padding-top:1rem;border-top:1px solid var(--border);color:var(--muted);font-size:.75rem;text-align:center}
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="subtitle">Scanned ${scannedFiles} files in ${scanDurationMs}ms</p>

  <div class="cards">
    <div class="card"><div class="card-num">${scannedFiles}</div><div class="card-label">Files Scanned</div></div>
    <div class="card"><div class="card-num">${uniqueFlags.length}</div><div class="card-label">Unique Flags</div></div>
    <div class="card"><div class="card-num">${totalUsages}</div><div class="card-label">Total Usages</div></div>
    <div class="card"><div class="card-num yellow">${staleCount}</div><div class="card-label">Stale Candidates</div></div>
    <div class="card"><div class="card-num blue">${dynamicCount}</div><div class="card-label">Dynamic Keys</div></div>
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

  <footer>Generated by FlagLint ${esc(version)} on ${esc(date)}</footer>

  <script>
    const input = document.getElementById('filter');
    const rows = document.querySelectorAll('#flags-table tbody tr');
    input.addEventListener('input', () => {
      const q = input.value.toLowerCase();
      rows.forEach(r => { r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none'; });
    });
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
    default:
      return formatMarkdown(result, options);
  }
}
