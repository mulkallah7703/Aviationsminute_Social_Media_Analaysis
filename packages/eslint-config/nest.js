const base = require('./base');

module.exports = [
  ...base,
  {
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
