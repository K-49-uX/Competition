import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
    // mongodb-memory-server downloads binaries on first run; bump the
    // hook timeout so cold CI environments don't trip.
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
