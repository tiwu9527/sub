import { spawnSync } from 'node:child_process';

const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const result = spawnSync(command, ['--prefix', '../frontend', 'run', 'build'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_API_BASE_URL: '/api'
  }
});

process.exit(result.status ?? 1);
