// Bindings and vars from wrangler.toml.
export interface Env {
  BOARD: D1Database;
  REPLAY: D1Database;
  SAVE: D1Database;
  READ_LIMIT: RateLimit;
  WRITE_LIMIT: RateLimit;
  GLOBAL_WRITE_LIMIT: RateLimit;
  DEVICE_LIMIT: RateLimit;
  CORS_ORIGINS: string;
  CORS_LAN: string;
}
