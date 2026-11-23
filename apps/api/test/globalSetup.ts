import { execSync } from 'node:child_process';

/** Fresh, seeded test database for the end-to-end suite. Never touches the dev database. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://kiwanja:kiwanja@localhost:5432/kiwanja_test?schema=public';
  if (!/test/.test(url)) throw new Error('Refusing to reset a database whose name does not contain "test"');
  const env = { ...process.env, DATABASE_URL: url };
  execSync('npx prisma migrate reset --force --skip-seed --skip-generate', { env, stdio: 'ignore' });
  execSync('npx tsx prisma/seed.ts', { env, stdio: 'ignore' });
}
