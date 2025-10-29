// utils/jwt.js
import jwt from 'jsonwebtoken';

const ACCESS_TTL  = process.env.ACCESS_TTL  || '15m';
const REFRESH_TTL = process.env.REFRESH_TTL || '30d';
const secret = process.env.JWT_SECRET;

export const signAccess = (user) =>
  jwt.sign({ id: user._id, role: user.role || 'user' }, secret, { expiresIn: ACCESS_TTL });

export const signRefresh = (user, tokenId) =>
  jwt.sign({ sub: String(user._id), tid: tokenId }, secret, { expiresIn: REFRESH_TTL });

export const verifyToken = (t) => jwt.verify(t, secret);
