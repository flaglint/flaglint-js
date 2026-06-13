import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightBlog from "starlight-blog";

export default defineConfig({
  site: "https://flaglint.dev",
  // No base — docs content nested at docs-src/content/docs/docs/ generates /docs/* routes naturally.
  srcDir: "./docs-src",
  outDir: "./www",
  integrations: [
    starlight({
      plugins: [
        starlightBlog({
          title: "FlagLint Blog",
          prefix: "blog",
          navigation: "none",
          recentPostCount: 5,
          metrics: {
            readingTime: true,
          },
        }),
      ],
      favicon: "/favicon.svg",
      title: "FlagLint",
      description:
        "FlagLint documentation and engineering notes for auditing LaunchDarkly Node.js SDK usage, previewing safe OpenFeature migrations, and enforcing the boundary in CI.",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/flaglint/flaglint",
        },
      ],
      customCss: ["./docs-src/styles/starlight.css"],
      components: {
        SiteTitle: "./docs-src/components/StarlightSiteTitle.astro",
      },
      editLink: {
        baseUrl: "https://github.com/flaglint/flaglint/edit/main/",
      },
      lastUpdated: true,
      pagination: true,
      credits: false,
      sidebar: [
        {
          label: "Blog",
          items: [
            { label: "All posts", link: "/blog/" },
          ],
        },
        {
          label: "Start Here",
          collapsed: true,
          items: [
            { label: "Overview", slug: "docs" },
            { label: "Quickstart", slug: "docs/quickstart" },
            { label: "Why FlagLint", slug: "docs/why-flaglint" },
            { label: "Enterprise Demo", slug: "docs/enterprise-demo" },
          ],
        },
        {
          label: "Tutorials",
          collapsed: true,
          items: [
            { label: "Migrate a Node Service", slug: "docs/tutorials/migrate-a-node-service" },
            { label: "Add OpenFeature Provider", slug: "docs/tutorials/add-openfeature-provider" },
            { label: "Enforce in GitHub Actions", slug: "docs/tutorials/enforce-in-github-actions" },
            { label: "Shared Client Architecture", slug: "docs/tutorials/shared-client-architecture" },
          ],
        },
        {
          label: "Concepts",
          collapsed: true,
          items: [
            { label: "How FlagLint Works", slug: "docs/concepts/how-flaglint-works" },
            { label: "Safety Model", slug: "docs/concepts/safety-model" },
            { label: "OpenFeature Boundary", slug: "docs/concepts/openfeature-boundary" },
            { label: "Source-Level Debt Signals", slug: "docs/concepts/source-level-debt-signals" },
            { label: "Migration Readiness", slug: "docs/concepts/migration-readiness" },
          ],
        },
        {
          label: "CLI",
          collapsed: true,
          items: [
            { label: "audit", slug: "docs/cli/audit" },
            { label: "Effort Estimation", slug: "docs/cli/effort-estimate" },
            { label: "scan", slug: "docs/cli/scan" },
            { label: "migrate", slug: "docs/cli/migrate" },
            { label: "validate", slug: "docs/cli/validate" },
            { label: "Configuration", slug: "docs/cli/configuration" },
            { label: "Report Formats", slug: "docs/cli/report-formats" },
            { label: "Exit Codes", slug: "docs/cli/exit-codes" },
          ],
        },
        {
          label: "Guides",
          collapsed: true,
          items: [
            { label: "Express", slug: "docs/guides/express" },
            { label: "NestJS", slug: "docs/guides/nestjs" },
            { label: "Monorepos", slug: "docs/guides/monorepos" },
            { label: "Manual Review Patterns", slug: "docs/guides/manual-review-patterns" },
            { label: "Troubleshooting", slug: "docs/guides/troubleshooting" },
          ],
        },
        {
          label: "Reference",
          collapsed: true,
          items: [
            { label: "Supported Scope", slug: "docs/reference/supported-scope" },
            { label: "Limitations", slug: "docs/reference/limitations" },
            { label: "FAQ", slug: "docs/reference/faq" },
            { label: "Changelog", slug: "docs/reference/changelog" },
          ],
        },
        {
          label: "Integrations",
          collapsed: true,
          items: [
            { label: "GitHub Actions", slug: "docs/integrations/github-actions" },
            { label: "OpenTelemetry", slug: "docs/integrations/opentelemetry" },
          ],
        },
        {
          label: "Trust",
          collapsed: true,
          items: [
            { label: "Security", slug: "docs/trust/security" },
            { label: "Privacy", slug: "docs/trust/privacy" },
          ],
        },
      ],
      head: [
        {
          tag: "meta",
          attrs: {
            property: "og:site_name",
            content: "FlagLint",
          },
        },
        {
          tag: "script",
          attrs: { type: "module" },
          content: `
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
function initMermaid() {
  const isDark = document.documentElement.dataset.theme !== 'light';
  mermaid.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default' });
  mermaid.run({ querySelector: 'pre.mermaid' });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMermaid);
} else {
  initMermaid();
}
document.addEventListener('astro:after-swap', initMermaid);
`,
        },
      ],
    }),
  ],
});
