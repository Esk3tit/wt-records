//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  ...tanstackConfig,
  {
    rules: {
      'import/no-cycle': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      'pnpm/json-enforce-catalog': 'off',
    },
  },
  {
    ignores: [
      'eslint.config.js',
      'prettier.config.js',
      'src/og/assets/embedded.ts',
      'src/lib/countries.generated.ts',
      'src/lib/country-flags.generated.ts',
      '.output/**',
      '.nitro/**',
      // The local Supabase CLI's scratch state, written by `supabase start`.
      'supabase/.temp/**',
      '.tanstack/**',
      'dist/**',
      '.claude/**',
      'wt-glass-concept.html',
      '.design-sync/**',
      '.ds-sync/**',
      'ds-bundle/**',
    ],
  },
]
