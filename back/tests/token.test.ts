import { describe, expect, it } from 'vitest';
import { signToken, verifyToken } from '../src/auth/token';

describe('token', () => {
  it('signe puis vérifie un token', () => {
    const payload = { sub: 'user-1', email: 'contact@acme.fr', role: 'ENTREPRISE' as const };
    expect(verifyToken(signToken(payload))).toMatchObject(payload);
  });

  it('renvoie null pour un token bidon', () => {
    expect(verifyToken('pas.un.token')).toBeNull();
  });
});
