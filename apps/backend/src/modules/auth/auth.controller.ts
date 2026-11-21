import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authenticate.js';
import { env } from '../../config/env.js';
import { getUserById } from '../users/user.service.js';
import { login, logout, refresh, register } from './auth.service.js';

const cookieName = 'refresh_token';

export function setRefreshCookie(res: Response, token: string) {
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/api/auth',
    maxAge: env.REFRESH_TOKEN_EXPIRES_IN.match(/^([0-9]+)d$/)
      ? Number(env.REFRESH_TOKEN_EXPIRES_IN.slice(0, -1)) * 86400000
      : 7 * 86400000,
  });
}

export async function registerController(req: AuthenticatedRequest, res: Response) {
  const result = await register(req.body);
  setRefreshCookie(res, result.refreshToken);
  res.status(201).json({ success: true, message: 'Registration successful', data: { user: result.user, accessToken: result.accessToken } });
}

export async function loginController(req: AuthenticatedRequest, res: Response) {
  const result = await login(req.body);
  setRefreshCookie(res, result.refreshToken);
  res.json({ success: true, message: 'Login successful', data: { user: result.user, accessToken: result.accessToken } });
}

export async function refreshController(req: AuthenticatedRequest, res: Response) {
  const result = await refresh(req.cookies[cookieName]);
  setRefreshCookie(res, result.refreshToken);
  res.json({ success: true, message: 'Session refreshed', data: { user: result.user, accessToken: result.accessToken } });
}

export async function logoutController(req: AuthenticatedRequest, res: Response) {
  await logout(req.cookies[cookieName]);
  res.clearCookie(cookieName, { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax', path: '/api/auth' });
  res.json({ success: true, message: 'Logout successful', data: null });
}

export async function meController(req: AuthenticatedRequest, res: Response) {
  const user = await getUserById(req.user!.id);
  res.json({ success: true, message: 'Authenticated user', data: { user } });
}
