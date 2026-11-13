import { createHash, randomBytes } from 'node:crypto';

/** Um token novo da sessão ou do link: 32 bytes aleatórios, em base64url. */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/** O que o banco guarda do token: o SHA-256 dele, em hexadecimal. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
