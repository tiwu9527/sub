import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      'react-hooks/set-state-in-effect': 'off'
    }
  },
  globalIgnores([
    '.next/**',
    '.local-data/**',
    '.local-logs/**',
    '.npm-cache/**',
    'out/**',
    'build/**',
    'next-env.d.ts'
  ])
]);
