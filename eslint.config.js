import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import react from 'eslint-plugin-react'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'docs/v1-legacy']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: { react },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // Core `no-undef` does NOT see JSX element names — verified: a bare
      // `SomeUndefined` is caught, `<SomeUndefined />` is not. So a forgotten
      // component import passes lint AND `vite build` (esbuild does no scope
      // analysis) and only fails at runtime with "X is not defined".
      // That exact bug shipped as a white-screen crash on /storefront/links.
      'react/jsx-no-undef': 'error',
      // Marks JSX-referenced identifiers as used, so importing a component and
      // rendering it doesn't trip no-unused-vars.
      'react/jsx-uses-vars': 'error',
    },
  },
])
