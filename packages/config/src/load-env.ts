import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';

const ENV_CANDIDATES = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
  resolve(process.cwd(), '../../../.env'),
];

export function loadRootEnv(): string | undefined {
  for (const filePath of ENV_CANDIDATES) {
    if (existsSync(filePath)) {
      config({ path: filePath, override: false });
      return filePath;
    }
  }

  return undefined;
}
