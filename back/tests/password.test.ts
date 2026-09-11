import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/password';

describe('password', () => {
  it('ne stocke jamais le mot de passe en clair', async () => {
    const hash = await hashPassword('motdepasse');
    expect(hash).not.toContain('motdepasse');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('accepte le bon mot de passe et refuse le mauvais', async () => {
    const hash = await hashPassword('motdepasse');
    expect(await verifyPassword(hash, 'motdepasse')).toBe(true);
    expect(await verifyPassword(hash, 'mauvais')).toBe(false);
    expect(await verifyPassword('pas-un-hash', 'motdepasse')).toBe(false);
  });
});
