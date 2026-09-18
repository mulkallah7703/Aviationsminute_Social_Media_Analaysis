const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

function parseEnvFile(filePath) {
  const parsed = {};
  const content = readFileSync(filePath, 'utf8');

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }

  return parsed;
}

function loadRootEnv() {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
    resolve(__dirname, '../../../.env'),
  ];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) {
      continue;
    }

    const parsed = parseEnvFile(filePath);
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
    return filePath;
  }

  return undefined;
}

function getDatabaseName(databaseUrl) {
  const match = databaseUrl.match(/database=([^;]+)/i);
  return match?.[1]?.trim();
}

function assertDigitalSocialMediaUrl(databaseUrl) {
  if (!databaseUrl || databaseUrl.includes('YOUR_') || databaseUrl.includes('placeholder')) {
    throw new Error(
      'DATABASE_URL is missing or still a placeholder. Copy .env.example to .env and point it at DigitalSocialMedia.',
    );
  }

  const databaseName = getDatabaseName(databaseUrl);
  if (!databaseName) {
    throw new Error('DATABASE_URL does not include a database= value.');
  }

  if (databaseName.toLowerCase() !== 'digitalsocialmedia') {
    throw new Error(
      `Refusing to continue: DATABASE_URL points at "${databaseName}", expected DigitalSocialMedia.`,
    );
  }
}

module.exports = {
  loadRootEnv,
  getDatabaseName,
  assertDigitalSocialMediaUrl,
};
