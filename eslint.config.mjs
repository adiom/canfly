import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'next/dist/client/components/redirect',
              message:
                'Переехал в next/dist/client/components/redirect-error (Next 16). Используйте его для isRedirectError.',
            },
            {
              name: 'next/dist/api/constants',
              message: 'Internal Next.js API. Используйте публичные экспорты.',
            },
            {
              name: 'next/dist/api/node',
              message: 'Internal Next.js API. Используйте публичные экспорты.',
            },
            {
              name: 'next/dist/build',
              message: 'Internal Next.js API. Используйте публичные экспорты.',
            },
            {
              name: 'next/dist/compiled',
              message: 'Internal Next.js API. Используйте публичные экспорты.',
            },
            {
              name: 'next/dist/server',
              message: 'Internal Next.js API. Используйте публичные экспорты.',
            },
            {
              name: 'next/dist/shared',
              message: 'Internal Next.js API. Используйте публичные экспорты.',
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'e2e/**',
    'playwright-report/**',
    'test-results/**',
    'node_modules/**',
    'public/**',
    'scripts/**',
    'postgres/**',
  ]),
])
