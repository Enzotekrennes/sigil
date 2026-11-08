/**
 * ESLint flat configuration.
 *
 * Type-aware rules from typescript-eslint (strictTypeChecked) on every
 * TypeScript file, React hooks rules on the app, and eslint-plugin-jsdoc to
 * require TSDoc on functions, classes and exported arrow functions without
 * duplicating TypeScript types. Formatting is left to Prettier.
 */
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsdoc from 'eslint-plugin-jsdoc';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // `site` is the documentation site (Astro), with its own dependencies and tooling.
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'site'] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  jsdoc.configs['flat/recommended-typescript-error'],
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'jsdoc/require-jsdoc': [
        'error',
        {
          require: {
            FunctionDeclaration: true,
            ClassDeclaration: true,
            MethodDefinition: true,
          },
          contexts: [
            'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression',
            'ExportDefaultDeclaration > ArrowFunctionExpression',
          ],
        },
      ],
      'jsdoc/no-types': 'error',
      // Component props are documented on their Props type, not as @param roots.
      'jsdoc/require-param': ['error', { checkDestructuredRoots: false }],
      // TSDoc writes `@param name - description`.
      'jsdoc/require-hyphen-before-param-description': ['error', 'always'],
      // TSDoc separates the summary from the block tags with one blank line.
      'jsdoc/tag-lines': ['error', 'any', { startLines: 1 }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    ...reactHooks.configs.flat['recommended-latest'],
  },
  {
    files: ['*.config.ts', 'e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
