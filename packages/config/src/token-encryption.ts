import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function keyFromSecret(secret: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(secret)) {
    return Buffer.from(secret, 'hex');
  }
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(plaintext: string, encryptionKey: string): string {
  const key = keyFromSecret(encryptionKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(
    ':',
  );
}

export function decryptSecret(payload: string, encryptionKey: string): string {
  const [version, ivPart, tagPart, dataPart] = payload.split(':');
  if (version !== VERSION || !ivPart || !tagPart || !dataPart) {
    throw new Error('Unsupported encrypted payload format.');
  }

  const key = keyFromSecret(encryptionKey);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64url')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
