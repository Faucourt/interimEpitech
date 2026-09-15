import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

/**
 * argon2id : variante recommandée par l'OWASP pour le stockage de mots de passe.
 * Elle résiste à la fois aux attaques par GPU et aux attaques par canal auxiliaire.
 * On ne stocke jamais le mot de passe, uniquement ce hash (qui embarque son propre sel).
 */
export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    // Hash malformé en base : on refuse plutôt que de laisser remonter une exception.
    return false;
  }
}

/**
 * Mot de passe temporaire remis à une entreprise à la création de son compte par l'admin.
 * 9 octets aléatoires → 12 caractères base64url, lisibles et sans caractère ambigu à copier.
 */
export function generateTemporaryPassword(): string {
  return randomBytes(9).toString('base64url');
}
