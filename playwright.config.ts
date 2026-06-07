import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:4321',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'ASTRO_TELEMETRY_DISABLED=1 npx astro preview --port 4321',
    port: 4321,
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
