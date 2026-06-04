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
          recentPostCount: 5,
        }),
      ],
      favicon: "/favicon.svg",
      title: "FlagLint Docs",
      description:
        "Technical articles on LaunchDarkly → OpenFeature migrations, argument-order bugs, and safe codemod patterns for Node.js teams.",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/flaglint/flaglint",
        },
      ],
      customCss: ["./docs-src/styles/starlight.css"],
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
            { label: "FlagLint Blog", link: "/blog/" },
          ],
        },
        {
          label: "Start Here",
          items: [
            { label: "Overview", slug: "docs" },
            { label: "Quickstart", slug: "docs/quickstart" },
            { label: "Why FlagLint", slug: "docs/why-flaglint" },
            { label: "Enterprise Demo", slug: "docs/enterprise-demo" },
          ],
        },
        {
          label: "Tutorials",
          items: [
            { label: "Migrate a Node Service", slug: "docs/tutorials/migrate-a-node-service" },
            { label: "Add OpenFeature Provider", slug: "docs/tutorials/add-openfeature-provider" },
            { label: "Enforce in GitHub Actions", slug: "docs/tutorials/enforce-in-github-actions" },
            { label: "Shared Client Architecture", slug: "docs/tutorials/shared-client-architecture" },
          ],
        },
        {
          label: "Concepts",
          items: [
            { label: "How FlagLint Works", slug: "docs/concepts/how-flaglint-works" },
            { label: "Safety Model", slug: "docs/concepts/safety-model" },
            { label: "OpenFeature Boundary", slug: "docs/concepts/openfeature-boundary" },
            { label: "Source-Level Debt Signals", slug: "docs/concepts/source-level-debt-signals" },
          ],
        },
        {
          label: "CLI",
          items: [
            { label: "scan", slug: "docs/cli/scan" },
            { label: "migrate", slug: "docs/cli/migrate" },
            { label: "validate", slug: "docs/cli/validate" },
            { label: "audit", slug: "docs/cli/audit" },
            { label: "Configuration", slug: "docs/cli/configuration" },
            { label: "Report Formats", slug: "docs/cli/report-formats" },
            { label: "Exit Codes", slug: "docs/cli/exit-codes" },
          ],
        },
        {
          label: "Guides",
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
          items: [
            { label: "Supported Scope", slug: "docs/reference/supported-scope" },
            { label: "Limitations", slug: "docs/reference/limitations" },
            { label: "Security", slug: "docs/reference/security" },
            { label: "FAQ", slug: "docs/reference/faq" },
            { label: "Changelog", slug: "docs/reference/changelog" },
          ],
        },
        {
          label: "Integrations",
          items: [
            { label: "GitHub Actions", slug: "docs/integrations/github-actions" },
            { label: "OpenTelemetry", slug: "docs/integrations/opentelemetry" },
          ],
        },
        {
          label: "Trust",
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
