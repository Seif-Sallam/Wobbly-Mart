/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { privacyHtml } from './src/privacy';
import { PALETTE } from './src/palette';

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

/**
 * Build only: the game page gets its CSP (connect-src names the Board API) and privacy.html gets the notice text.
 * Dev skips the CSP: Vite's dev server injects inline styles and a websocket.
 */
function pagesAtBuild(apiUrl: string | undefined): Plugin {
  const connect = ["'self'", 'blob:', 'data:', apiUrl ? new URL(apiUrl).origin : ''].filter(Boolean).join(' ');
  const csp =
    `default-src 'self'; connect-src ${connect}; script-src 'self'; ` +
    `img-src 'self' data: blob:; media-src 'self' data: blob:; style-src 'self' 'unsafe-inline'`;
  return {
    name: 'pages-at-build',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (ctx.path.endsWith('privacy.html'))
          return html.replace('<!--privacy-->', privacyHtml()).replace(
            '</head>',
            `<style>:root{--ink:${PALETTE.ink};--cream:${PALETTE.cream}}</style>
  </head>`,
          );
        if (ctx.server) return html;
        return html.replace(
          '<head>',
          `<head>
    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
        );
      },
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [layoutEditorSave(), pagesAtBuild(loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL)],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 800,
    rollupOptions: { input: { index: resolve('index.html'), privacy: resolve('privacy.html') } },
  },
  // flowing tests simulate an hour or more of play; CI runners are ~2× slower than a laptop
  test: {
    testTimeout: 30_000,
    projects: [{ extends: true, test: { name: 'game', include: ['src/**/*.test.ts'] } }, 'worker/vitest.config.ts'],
  },
}));
