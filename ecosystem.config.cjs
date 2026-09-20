/**
 * PM2 ecosystem for Aviationsminute Social Media
 *
 * Architecture choice: PM2 for web/api/worker + Docker for Redis only.
 * SQL Server remains external. Do not put secrets in this file — load from .env.
 *
 * Usage (on the VPS, from the repo root after build):
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 */
module.exports = {
  apps: [
    {
      name: 'sma-web',
      cwd: './apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start --hostname 127.0.0.1 --port 3000',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      kill_timeout: 10_000,
      listen_timeout: 10_000,
      time: true,
      env: {
        NODE_ENV: 'production',
        API_INTERNAL_URL: 'http://127.0.0.1:5000',
      },
      error_file: '../../logs/web-error.log',
      out_file: '../../logs/web-out.log',
      merge_logs: true,
    },
    {
      name: 'sma-api',
      cwd: './apps/api',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      kill_timeout: 15_000,
      listen_timeout: 10_000,
      time: true,
      env: {
        NODE_ENV: 'production',
        API_HOST: '127.0.0.1',
        API_PORT: '5000',
      },
      error_file: '../../logs/api-error.log',
      out_file: '../../logs/api-out.log',
      merge_logs: true,
    },
    {
      name: 'sma-worker',
      cwd: './apps/worker',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      kill_timeout: 30_000,
      time: true,
      env: {
        NODE_ENV: 'production',
      },
      error_file: '../../logs/worker-error.log',
      out_file: '../../logs/worker-out.log',
      merge_logs: true,
    },
  ],
};
