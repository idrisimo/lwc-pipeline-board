const { defineConfig } = require('eslint/config');
const lwcConfig = require('@salesforce/eslint-config-lwc');

module.exports = defineConfig([
    { ignores: ['node_modules/**', 'coverage/**'] },
    ...lwcConfig.configs.recommended,
    {
        files: ['**/__tests__/**/*.js'],
        languageOptions: { globals: { require: 'readonly' } },
        rules: {
            // Jest tests drive wire adapters through their test utilities
            '@lwc/lwc/no-unexpected-wire-adapter-usages': 'off',
            '@lwc/lwc/no-async-operation': 'off'
        }
    }
]);
