import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightBlog from "starlight-blog";

export default defineConfig({
  site: "https://flaglint.dev",
  base: "/docs",
  srcDir: "./docs-src",
  outDir: "./www/docs",
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
          label: "Start Here",
          items: [
            { label: "Overview", slug: "index" },
            { label: "Quickstart", slug: "quickstart" },
            { label: "Why FlagLint", slug: "why-flaglint" },
            { label: "Enterprise Demo", slug: "enterprise-demo" },
          ],
        },
        {
          label: "Tutorials",
          items: [
            { label: "Migrate a Node Service", slug: "tutorials/migrate-a-node-service" },
            { label: "Add OpenFeature Provider", slug: "tutorials/add-openfeature-provider" },
            { label: "Enforce in GitHub Actions", slug: "tutorials/enforce-in-github-actions" },
            { label: "Shared Client Architecture", slug: "tutorials/shared-client-architecture" },
          ],
        },
        {
          label: "Concepts",
          items: [
            { label: "How FlagLint Works", slug: "concepts/how-flaglint-works" },
            { label: "Safety Model", slug: "concepts/safety-model" },
            { label: "OpenFeature Boundary", slug: "concepts/openfeature-boundary" },
            { label: "Source-Level Debt Signals", slug: "concepts/source-level-debt-signals" },
          ],
        },
        {
          label: "CLI",
          items: [
            { label: "scan", slug: "cli/scan" },
            { label: "migrate", slug: "cli/migrate" },
            { label: "validate", slug: "cli/validate" },
            { label: "Configuration", slug: "cli/configuration" },
            { label: "Report Formats", slug: "cli/report-formats" },
            { label: "Exit Codes", slug: "cli/exit-codes" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "Express", slug: "guides/express" },
            { label: "NestJS", slug: "guides/nestjs" },
            { label: "Monorepos", slug: "guides/monorepos" },
            { label: "Manual Review Patterns", slug: "guides/manual-review-patterns" },
            { label: "Troubleshooting", slug: "guides/troubleshooting" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "Supported Scope", slug: "reference/supported-scope" },
            { label: "Limitations", slug: "reference/limitations" },
            { label: "Security", slug: "reference/security" },
            { label: "FAQ", slug: "reference/faq" },
            { label: "Changelog", slug: "reference/changelog" },
          ],
        },
        {
          label: "Integrations",
          items: [
            { label: "GitHub Actions", slug: "integrations/github-actions" },
            { label: "OpenTelemetry", slug: "integrations/opentelemetry" },
          ],
        },
        {
          label: "Trust",
          items: [
            { label: "Security", slug: "trust/security" },
            { label: "Privacy", slug: "trust/privacy" },
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
