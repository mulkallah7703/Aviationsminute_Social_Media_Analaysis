const nextConfig = require('@sma/eslint-config/next');

module.exports = [
  ...nextConfig,
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**', 'next-env.d.ts'],
  },
];
