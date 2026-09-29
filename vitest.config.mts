import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: [
        'src/utils/ledger.ts',
        'src/utils/money.ts',
        'src/utils/taxCalc.ts',
        'src/utils/recurring.ts',
      ],
      // יעד ≥90% על קבצי החישוב; load/save נסקרים בבדיקות נפרדות
      thresholds: {
        lines: 85,
        statements: 80,
        functions: 75,
        branches: 70,
      },
    },
  },
});
