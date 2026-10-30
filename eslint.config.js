import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'node_modules/', 'extension/vendor/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  {
    files: ['extension/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, ...globals.webextensions },
    },
    rules: {
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
  {
    // Chrome loads the shared modules into the service worker with importScripts.
    files: ['extension/scripts/background.js'],
    languageOptions: { globals: { importScripts: 'readonly' } },
  },
  {
    files: ['eslint.config.js', 'playwright.config.js', 'tools/**/*.mjs', 'tests/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: globals.node },
  },
  {
    // Page and service-worker callbacks in the screenshot tool run in the browser.
    files: ['tools/store-screenshots.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser, ...globals.webextensions } },
  },
  {
    // Page and service-worker callbacks in end-to-end tests run in the browser.
    files: ['tests/e2e/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser, ...globals.webextensions } },
    // Playwright fixtures without dependencies are declared as `async ({}, use) => …`.
    rules: { 'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }] },
  },
];
