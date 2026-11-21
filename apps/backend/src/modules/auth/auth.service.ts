import argon2 from 'argon2';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/errors.js';
import { createRefreshToken, hashRefreshToken } from '../../utils/crypto.js';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; name: string; email: string };
}

function refreshExpiry(): Date {
  const match = env.REFRESH_TOKEN_EXPIRES_IN.match(/^([0-9]+)([dh])$/);
  if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const amount = Number(match[1]);
  return new Date(Date.now() + amount * (match[2] === 'd' ? 86400000 : 3600000));
}

function accessToken(userId: string): string {
  return jwt.sign({}, env.JWT_ACCESS_SECRET, {
    subject: userId,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as SignOptions);
}

async function createSession(user: { id: string; name: string; email: string }): Promise<AuthResult> {
  const refreshToken = createRefreshToken();
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hashRefreshToken(refreshToken), expiresAt: refreshExpiry() },
  });
  return { accessToken: accessToken(user.id), refreshToken, user };
}

export async function register(input: { name: string; email: string; password: string }): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError(409, 'An account with this email already exists');
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  const user = await prisma.user.create({
    data: { name: input.name, email: input.email, passwordHash },
    select: { id: true, name: true, email: true },
  });
  return createSession(user);
}

export async function login(input: { email: string; password: string }): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const invalid = () => new AppError(401, 'Invalid email or password');
  if (!user) throw invalid();
  if (!(await argon2.verify(user.passwordHash, input.password))) throw invalid();
  return createSession({ id: user.id, name: user.name, email: user.email });
}

export async function refresh(rawToken: string): Promise<AuthResult> {
  if (!rawToken) throw new AppError(401, 'Refresh session expired');
  const tokenHash = hashRefreshToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!existing || existing.revokedAt || existing.expiresAt <= new Date()) {
    if (existing) {
      await prisma.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    throw new AppError(401, 'Refresh session expired');
  }

  const rotatedToken = createRefreshToken();
  const result = await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
    await tx.refreshToken.create({
      data: { userId: existing.userId, tokenHash: hashRefreshToken(rotatedToken), expiresAt: refreshExpiry() },
    });
    return {
      accessToken: accessToken(existing.user.id),
      refreshToken: rotatedToken,
      user: existing.user,
    };
  });
  return result;
}

export async function logout(rawToken?: string): Promise<void> {
  if (!rawToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
