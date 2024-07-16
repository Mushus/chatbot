import globals from 'globals';
import pluginJs from '@eslint/js';
import tsEslint from 'typescript-eslint';

export default [
    { files: ['**/*.{js,mjs,cjs,ts}'] },
    { languageOptions: { globals: globals.browser } },
    { ignores: ['**/node_modules/', '.git/', 'cdk.out/'] },
    {
        languageOptions: {
            parserOptions: {
                project: ['./tsconfig.json', './assets/tsconfig.json'],
            },
        },
    },
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    pluginJs.configs.recommended,
    ...tsEslint.configs.strictTypeChecked,
    {
        rules: {
            '@typescript-eslint/restrict-template-expressions': [
                'error',
                {
                    allowNumber: true,
                },
            ],
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    args: 'all',
                    argsIgnorePattern: '^_',
                    caughtErrors: 'all',
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    ignoreRestSiblings: true,
                },
            ],
        },
    },
];
