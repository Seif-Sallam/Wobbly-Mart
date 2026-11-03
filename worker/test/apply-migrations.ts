import { applyD1Migrations, env } from 'cloudflare:test';

const { TEST_MIGRATIONS: m } = env as unknown as {
  TEST_MIGRATIONS: Record<'BOARD' | 'REPLAY' | 'SAVE', Parameters<typeof applyD1Migrations>[1]>;
};
await applyD1Migrations(env.BOARD, m.BOARD);
await applyD1Migrations(env.REPLAY, m.REPLAY);
await applyD1Migrations(env.SAVE, m.SAVE);
