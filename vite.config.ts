import { defineConfig, type Plugin } from 'vite';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Dev server only: the layout editor's Save rewrites maps/<id>/layout.ts (Prettier-formatted). */
function layoutEditorSave(): Plugin {
  return {
    name: 'layout-editor-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__editor/save', (req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', async () => {
          try {
            const { map, source } = JSON.parse(body) as { map: string; source: string };
            if (!/^[a-z0-9-]+$/.test(map)) throw new Error(`Bad map id ${map}`);
            const prettier = await import('prettier');
            const file = resolve('maps', map, 'layout.ts');
            const options = (await prettier.resolveConfig(file)) ?? {};
            writeFileSync(file, await prettier.format(source, { ...options, filepath: file }));
            res.end('ok');
          } catch (e) {
            res.statusCode = 500;
            res.end((e as Error).message);
          }
        });
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [layoutEditorSave()],
  build: { target: 'es2022', chunkSizeWarningLimit: 800 },
});
