// Phase 0.3 — Playwright E2E config.
//
// Drives the live dev server (server on :4000, client on :5173) — assumes
// `npm run dev` is already running. We deliberately don't auto-spawn the
// servers here because the project uses a real Mongo Atlas connection and
// we don't want the test runner thrashing the cluster.
//
// Run with:  npm run e2e
import { defineConfig, devices } from '@playwright/test';

console.log('[playwright config] loaded');

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.(spec|test)\.(c|m)?js$/,
  timeout: 60_000,
  retries: 0,
  reporter: [['list']],
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE || 'http://localhost:5173',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
