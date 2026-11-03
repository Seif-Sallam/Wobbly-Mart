import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';
import { join } from 'node:path';

const here = (path: string): string => join(import.meta.dirname, path);

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: here('./wrangler.toml') },
      miniflare: {
        // The global write budget is shared by every test; the per-IP and per-Device limits stay as deployed.
        ratelimits: { GLOBAL_WRITE_LIMIT: { namespace_id: '1003', simple: { limit: 1000, period: 60 } } },
        bindings: {
          TEST_MIGRATIONS: {
            BOARD: await readD1Migrations(here('./migrations/board')),
            REPLAY: await readD1Migrations(here('./migrations/replay')),
            SAVE: await readD1Migrations(here('./migrations/save')),
          },
        },
      },
    })),
  ],
  test: { name: 'worker', root: here('.'), include: ['test/**/*.test.ts'], setupFiles: ['./test/apply-migrations.ts'] },
});
