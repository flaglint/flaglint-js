import { test, expect } from '@playwright/test';

const CRITICAL_ROUTES = ['/', '/docs/', '/docs/quickstart/', '/blog/', '/docs/guides/launchdarkly-to-openfeature-nodejs/'];

for (const route of CRITICAL_ROUTES) {
  test(`${route} loads without error`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(route);
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('h1').first()).toBeVisible();
    expect(errors).toHaveLength(0);
  });
}

test('primary nav links are present on /docs/', async ({ page }) => {
  await page.goto('/docs/');
  await expect(page.getByRole('link', { name: 'Docs' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Blog' }).first()).toBeVisible();
});

test('Docs nav link is active on /docs/', async ({ page }) => {
  await page.goto('/docs/');
  const docsLink = page.locator('.nav-link.active').first();
  await expect(docsLink).toBeVisible();
  await expect(docsLink).toContainText('Docs');
});

test('theme selector is present on /docs/', async ({ page }) => {
  await page.goto('/docs/');
  const themeControl = page
    .locator(
      'starlight-theme-select, [data-sl-theme-toggle], button[aria-label*="theme" i]'
    )
    .first();
  await expect(themeControl).toBeVisible();
});

test('migration guide has exactly one H1', async ({ page }) => {
  await page.goto('/docs/guides/launchdarkly-to-openfeature-nodejs/');
  const h1s = page.locator('h1');
  await expect(h1s).toHaveCount(1);
});

test('migration guide has meta description', async ({ page }) => {
  await page.goto('/docs/guides/launchdarkly-to-openfeature-nodejs/');
  const meta = page.locator('meta[name="description"]');
  await expect(meta).toHaveAttribute('content', /OpenFeature/);
});

test('migration guide audit command is visible', async ({ page }) => {
  await page.goto('/docs/guides/launchdarkly-to-openfeature-nodejs/');
  await expect(page.getByText('npx flaglint@latest audit ./src').first()).toBeVisible();
});

test('migration guide is in the Guides sidebar section', async ({ page }) => {
  await page.goto('/docs/guides/launchdarkly-to-openfeature-nodejs/');
  await expect(page.getByRole('link', { name: 'LaunchDarkly to OpenFeature (Node.js)' }).first()).toBeVisible();
});
