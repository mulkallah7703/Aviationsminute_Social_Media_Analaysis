import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// Load monorepo root .env so NEXT_PUBLIC_* is available at build/dev time.
loadEnvConfig(path.join(__dirname, '../..'));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname, '../..'),
  // Keep production source maps off the public CDN path; enable only if debugging.
  productionBrowserSourceMaps: false,
};

export default nextConfig;
