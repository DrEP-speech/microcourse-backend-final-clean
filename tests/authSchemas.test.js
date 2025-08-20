import { describe, it, expect } from 'vitest';
import { signupSchema, loginSchema } from '../validators/authSchemas.js';

describe('auth request schemas', () => {
  it('signup valid', async () => {
    const payload = { name: 'Tester', email: 'tester@example.com', password: 'secret123' };
    const parsed = await signupSchema.parseAsync(payload);
    expect(parsed.email).toBe('tester@example.com');
  });

  it('signup invalid (no name)', async () => {
    await expect(signupSchema.parseAsync({ email: 'a@b.com', password: 'secret123' }))
      .rejects.toMatchObject({ issues: expect.any(Array) });
  });

  it('login valid with email', async () => {
    const payload = { email: 'tester@example.com', password: 'secret123' };
    const parsed = await loginSchema.parseAsync(payload);
    expect(parsed.email).toBe('tester@example.com');
  });

  it('login valid with identifier', async () => {
    const payload = { identifier: 'tester', password: 'secret123' };
    const parsed = await loginSchema.parseAsync(payload);
    expect(parsed.identifier).toBe('tester');
  });

  it('login invalid (missing email/identifier)', async () => {
    await expect(loginSchema.parseAsync({ password: 'secret123' }))
      .rejects.toMatchObject({ issues: expect.any(Array) });
  });
});
