import { describe, it, expect } from 'vitest';
import {
  SignupResponseSchema, LoginResponseSchema, MeResponseSchema, RefreshResponseSchema,
} from '../validators/response/authResponses.js';

const user = {
  _id: 'abc123',
  email: 'tester@example.com',
  name: 'Tester',
  role: 'student',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('auth response schemas', () => {
  it('signup response ok', () => {
    const parsed = SignupResponseSchema.parse({ success: true, user });
    expect(parsed.user.email).toBe('tester@example.com');
  });

  it('login response ok', () => {
    const parsed = LoginResponseSchema.parse({ success: true, user });
    expect(parsed.user._id).toBe('abc123');
  });

  it('me response ok', () => {
    const parsed = MeResponseSchema.parse({ success: true, user });
    expect(parsed.user.role).toBe('student');
  });

  it('refresh response ok (token optional)', () => {
    const parsed = RefreshResponseSchema.parse({ success: true });
    expect(parsed.success).toBe(true);
  });
});
