import 'server-only';

import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';

const adminCredentialId = 'default';
const defaultDevelopmentPassword = 'admin';
const passwordHashAlgorithm = 'scrypt-v1';
const passwordHashBytes = 64;
const passwordHashCost = 16_384;
const passwordHashBlockSize = 8;
const passwordHashParallelization = 1;

export const minimumAdminPasswordLength = 8;
export const maximumAdminPasswordLength = 128;

export type AdminPasswordVerification = {
  configured: boolean;
  valid: boolean;
  source: 'database' | 'bootstrap' | 'unconfigured';
  sessionGeneration: string | null;
};

export async function verifyAdminPassword(password: string): Promise<AdminPasswordVerification> {
  const credential = await prisma.adminCredential.findUnique({
    where: { id: adminCredentialId },
    select: { passwordHash: true, sessionGeneration: true }
  });

  if (credential) {
    return {
      configured: true,
      valid: await verifyPasswordHash(password, credential.passwordHash),
      source: 'database',
      sessionGeneration: credential.sessionGeneration
    };
  }

  const configuredPassword = process.env.ADMIN_PASSWORD;
  const fallbackPassword = configuredPassword || (process.env.NODE_ENV === 'production' ? '' : defaultDevelopmentPassword);
  return {
    configured: Boolean(fallbackPassword),
    valid: Boolean(fallbackPassword) && safeEquals(password, fallbackPassword),
    source: fallbackPassword ? 'bootstrap' : 'unconfigured',
    sessionGeneration: null
  };
}

export async function initializeAdminCredential(password: string, verification: AdminPasswordVerification) {
  if (!verification.valid) throw new Error('Cannot initialize an unverified administrator credential.');
  if (verification.source === 'database' && verification.sessionGeneration) return verification.sessionGeneration;
  if (verification.source !== 'bootstrap') throw new Error('Administrator authentication is not configured.');

  const passwordHash = await createPasswordHash(password);
  const sessionGeneration = createSessionGeneration();
  try {
    const credential = await prisma.adminCredential.create({
      data: {
        id: adminCredentialId,
        passwordHash,
        sessionGeneration
      },
      select: { sessionGeneration: true }
    });
    return credential.sessionGeneration;
  } catch (error) {
    const concurrentCredential = await prisma.adminCredential.findUnique({
      where: { id: adminCredentialId },
      select: { passwordHash: true, sessionGeneration: true }
    });
    if (concurrentCredential && (await verifyPasswordHash(password, concurrentCredential.passwordHash))) {
      return concurrentCredential.sessionGeneration;
    }
    throw error;
  }
}

export async function replaceAdminPassword(password: string, expectedSessionGeneration: string) {
  const passwordHash = await createPasswordHash(password);
  const sessionGeneration = createSessionGeneration();
  const result = await prisma.adminCredential.updateMany({
    where: { id: adminCredentialId, sessionGeneration: expectedSessionGeneration },
    data: { passwordHash, sessionGeneration }
  });

  if (result.count !== 1) throw new AdminCredentialConflictError();
  return sessionGeneration;
}

export async function getAdminCredentialSessionGeneration() {
  const credential = await prisma.adminCredential.findUnique({
    where: { id: adminCredentialId },
    select: { sessionGeneration: true }
  });
  return credential?.sessionGeneration ?? null;
}

export function getAdminPasswordValidationError(password: string) {
  if (password.length < minimumAdminPasswordLength) {
    return `新密码至少需要 ${minimumAdminPasswordLength} 个字符。`;
  }
  if (password.length > maximumAdminPasswordLength || Buffer.byteLength(password, 'utf8') > 512) {
    return `新密码不能超过 ${maximumAdminPasswordLength} 个字符。`;
  }
  if (!/\S/.test(password)) return '新密码不能全部为空格。';
  return null;
}

async function createPasswordHash(password: string) {
  const salt = randomBytes(16).toString('base64url');
  const derivedKey = await derivePasswordKey(password, salt);
  return `${passwordHashAlgorithm}$${salt}$${derivedKey.toString('base64url')}`;
}

async function verifyPasswordHash(password: string, encodedHash: string) {
  const [algorithm, salt, digest, ...extraParts] = encodedHash.split('$');
  if (algorithm !== passwordHashAlgorithm || !salt || !digest || extraParts.length > 0) return false;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(salt) || !/^[A-Za-z0-9_-]+$/.test(digest)) return false;

  try {
    const expectedKey = Buffer.from(digest, 'base64url');
    if (expectedKey.length !== passwordHashBytes) return false;
    const actualKey = await derivePasswordKey(password, salt);
    return timingSafeEqual(actualKey, expectedKey);
  } catch {
    return false;
  }
}

function derivePasswordKey(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      passwordHashBytes,
      {
        N: passwordHashCost,
        r: passwordHashBlockSize,
        p: passwordHashParallelization,
        maxmem: 64 * 1024 * 1024
      },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      }
    );
  });
}

function createSessionGeneration() {
  return randomBytes(32).toString('base64url');
}

function safeEquals(value: string, expected: string) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return valueBuffer.length === expectedBuffer.length && timingSafeEqual(valueBuffer, expectedBuffer);
}

export class AdminCredentialConflictError extends Error {
  constructor() {
    super('Administrator credentials changed during the request.');
    this.name = 'AdminCredentialConflictError';
  }
}
