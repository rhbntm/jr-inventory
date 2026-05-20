import 'dotenv/config';
import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { db } from '@/lib/db';

async function cleanup() {
  try {
    await db.stockMovement.deleteMany();
  } catch {}
  try {
    await db.productVariant.deleteMany();
  } catch {}
  try {
    await db.product.deleteMany();
  } catch {}
  try {
    await db.category.deleteMany();
  } catch {}
  try {
    await db.session.deleteMany();
  } catch {}
  try {
    await db.account.deleteMany();
  } catch {}
  try {
    await db.user.deleteMany();
  } catch {}
  try {
    await db.verificationToken.deleteMany();
  } catch {}
}

beforeAll(async () => {
  await db.$connect();
  await cleanup();
});

afterEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});
