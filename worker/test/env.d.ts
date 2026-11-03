import type { Env as WorkerEnv } from '../env';

declare global {
  namespace Cloudflare {
    interface GlobalProps {
      mainModule: typeof import('../index');
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Env extends WorkerEnv {}
  }
}
