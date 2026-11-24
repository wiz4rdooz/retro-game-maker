import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'packages/editor/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173/?testhooks',
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      executablePath: process.env.CHROME_PATH || undefined,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: {
    command: 'npm run build -w @rgm/editor && npm run preview -w @rgm/editor -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
