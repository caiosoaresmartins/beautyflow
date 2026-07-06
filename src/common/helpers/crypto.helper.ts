import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits

function getKey(): Buffer {
  const raw = process.env.AES_SECRET_KEY ?? '';
  if (!raw) throw new Error('AES_SECRET_KEY não configurada.');
  // Normaliza para 32 bytes (SHA-256 do segredo)
  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * Criptografa texto com AES-256-GCM.
 * Retorna string base64: iv(12):authTag(16):ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Descriptografa string gerada por encrypt().
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Formato de dado criptografado inválido.');

  const [ivB64, authTagB64, encryptedB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const encryptedData = Buffer.from(encryptedB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encryptedData), decipher.final()]).toString('utf8');
}

/** Retorna true se o valor parecer estar criptografado (3 partes base64) */
export function isEncrypted(value: string): boolean {
  return value.split(':').length === 3;
}
