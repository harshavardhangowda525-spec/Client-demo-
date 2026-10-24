import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

export default function setup() {
  const url = process.env.TEST_DATABASE_URL!;
  execSync('npx prisma migrate deploy', {
    cwd: resolve(__dirname, '../../db'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
