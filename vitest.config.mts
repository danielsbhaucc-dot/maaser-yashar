import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const core = (k: string) => fileURLToPath(new URL(`./packages/@core/${k}/src/index.ts`, import.meta.url));

export default defineConfig({
  // platform-core kits (core-sync): bare @core/<kit> imports between kits
  resolve: { alias: { '@core/crypto': core('crypto'), '@core/audit': core('audit') } },
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
