import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Mirrors the `paths` alias of tsconfig.json.
    alias: { '@shared': path.resolve(__dirname, '../shared') },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Sets the environment variables before any application module is imported.
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // index.ts, mongo.ts and the supabaseRepository / mongoRepository files only wire the real
      // database clients: not testable offline.
      exclude: ['src/index.ts', 'src/mongo.ts', 'src/**/supabaseRepository.ts', 'src/**/mongoRepository.ts'],
      // The coverage report is a graded deliverable: HTML for the defense, lcov for CI tools.
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
