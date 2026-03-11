const globals = require('globals');

module.exports = [
  {
    ignores: ['node_modules/**', 'miniprogram_npm/**', 'lib/**', 'components/canvasdrawer/**']
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.node,
        wx: 'readonly',
        App: 'readonly',
        Page: 'readonly',
        Component: 'readonly',
        Behavior: 'readonly',
        getApp: 'readonly',
        getCurrentPages: 'readonly',
        requirePlugin: 'readonly'
      }
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': 'off',
      'no-empty': 'off',
      'no-case-declarations': 'off',
      'no-dupe-keys': 'off',
      'no-constant-condition': 'off',
      'no-redeclare': 'off',
      'no-undef': 'off',
      'no-useless-escape': 'off',
      'no-prototype-builtins': 'off',
      'no-unsafe-negation': 'off',
      'no-self-assign': 'off',
      'no-global-assign': 'off'
    }
  }
];
