import 'server-only';

import { mkdirSync } from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) {
  const databasePath = path.join(process.cwd(), '.local-data', 'subscriptions.db');
  mkdirSync(path.dirname(databasePath), { recursive: true });
  process.env.DATABASE_URL = `file:${databasePath.replace(/\\/g, '/')}`;
}

const globalForPrisma = globalThis as typeof globalThis & {
  __subscriptionPrisma?: PrismaClient;
};

export const prisma = globalForPrisma.__subscriptionPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.__subscriptionPrisma = prisma;
