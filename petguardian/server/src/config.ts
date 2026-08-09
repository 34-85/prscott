import dotenv from 'dotenv';

dotenv.config();

const isTest = process.env.NODE_ENV === 'test';

function required(name: string, fallback?: string): string {
  const val = process.env[name] ?? fallback;
  if (val === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  isTest,
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: isTest
    ? required('TEST_DATABASE_URL', 'postgresql://postgres@127.0.0.1:5432/pettrust_test')
    : required('DATABASE_URL', 'postgresql://postgres@127.0.0.1:5432/pettrust'),
  jwtSecret: required('JWT_SECRET', 'dev-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
};
