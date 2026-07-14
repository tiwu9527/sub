import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

if (!process.env.DATABASE_URL) {
  const databaseDirectory = path.join(process.cwd(), '.local-data');
  mkdirSync(databaseDirectory, { recursive: true });
  process.env.DATABASE_URL = `file:${path.join(databaseDirectory, 'subscriptions.db').replace(/\\/g, '/')}`;
}

const prismaCli = path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js');
for (const argumentsList of [['generate'], ['migrate', 'deploy']]) {
  const result = spawnSync(process.execPath, [prismaCli, ...argumentsList], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit'
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
