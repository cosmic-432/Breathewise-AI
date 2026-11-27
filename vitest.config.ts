import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'src/utils/**/*.ts',
        'src/schemas/**/*.ts',
        'src/storage/**/*.ts',
        'src/api/**/*.ts',
        'src/hooks/**/*.ts',
        'src/services/**/*.ts',
        'src/server/**/*.ts',
        'server.ts',
      ],
      exclude: ['src/tests/**'],
    },
  },
});
