import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET ?? 'dev-only-insecure-secret';
if (isProd && (!process.env.JWT_SECRET || jwtSecret.length < 32)) {
  throw new Error('JWT_SECRET must be set to a long random string in production.');
}

export const config = {
  isProd,
  isTest: process.env.NODE_ENV === 'test' || !!process.env.VITEST,
  port: Number(process.env.PORT ?? 4000),
  jwtSecret,
  jwtTtl: '7d',
  webOrigin: (process.env.WEB_ORIGIN ?? 'http://localhost:5173,http://localhost:8081').split(','),
};
