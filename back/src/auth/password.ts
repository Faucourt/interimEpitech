import argon2 from 'argon2';

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
