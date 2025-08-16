// validators/authSchemas.js
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSignup(body) {
  const value = {
    name: (body.name ?? '').toString().trim(),
    email: (body.email ?? '').toString().trim().toLowerCase(),
    password: (body.password ?? '').toString(),
  };
  if (!value.email || !value.password) return { value, error: 'email and password required' };
  if (!emailRe.test(value.email)) return { value, error: 'Invalid email' };
  if (value.password.length < 6) return { value, error: 'Password must be at least 6 characters' };
  return { value, error: null };
}

export function validateLogin(body) {
  const value = {
    email: (body.email ?? '').toString().trim().toLowerCase(),
    password: (body.password ?? '').toString(),
  };
  if (!value.email || !value.password) return { value, error: 'email and password required' };
  if (!emailRe.test(value.email)) return { value, error: 'Invalid email' };
  return { value, error: null };
}
