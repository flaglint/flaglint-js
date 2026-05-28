import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://flaglint.dev",
  base: "/docs",
  srcDir: "./docs-src",
  outDir: "./www/docs",
  integrations: [
    starlight({
      title: "FlagLint Docs",
      description:
        "Documentation for standardizing LaunchDarkly Node.js server SDK usage on OpenFeature with FlagLint.",
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
            { label: "Enterprise Demo", slug: "enterprise-demo" },
          ],
        },
        {
          label: "CLI",
          items: [
            { label: "scan", slug: "cli/scan" },
            { label: "migrate", slug: "cli/migrate" },
            { label: "validate", slug: "cli/validate" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "Supported Scope", slug: "reference/supported-scope" },
            { label: "OpenFeature Provider Setup", slug: "integrations/openfeature-provider" },
            { label: "Safety Model", slug: "concepts/safety-model" },
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
      ],
    }),
  ],
});
