import { test, expect } from '@playwright/test';

const CRITICAL_ROUTES = ['/', '/docs/', '/docs/quickstart/', '/blog/'];

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
