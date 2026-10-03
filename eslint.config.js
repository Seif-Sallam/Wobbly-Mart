import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

const restrict = (patterns) => ({ 'no-restricted-imports': ['error', { patterns }] });

export default tseslint.config(
  { ignores: ['dist', 'public', '.scratch', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { '@typescript-eslint/no-dynamic-delete': 'off' },
  },
  // sim/ is pure rules: no rendering, UI, input or browser clocks
  {
    files: ['src/sim/**'],
    rules: {
      ...restrict([
        {
          group: ['three', 'three/*', 'preact', 'preact/*', 'howler', 'nipplejs', 'lil-gui'],
          message: 'sim/ stays pure',
        },
        {
          group: ['**/view/**', '**/ui/**', '**/input/**', '**/app/**', '**/audio/**'],
          message: 'sim/ must not import view/ui/input',
        },
      ]),
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Use the sim clock' },
        { object: 'Math', property: 'random', message: 'Use the seeded RNG' },
      ],
    },
  },
  // view/ and ui/ only read sim state
  {
    files: ['src/view/**'],
    rules: restrict([{ group: ['**/ui/**', 'preact', 'preact/*'], message: 'view/ must not import ui/' }]),
  },
  {
    files: ['src/ui/**'],
    rules: restrict([{ group: ['**/view/**', 'three', 'three/*'], message: 'ui/ must not import view/ or three' }]),
  },
);
