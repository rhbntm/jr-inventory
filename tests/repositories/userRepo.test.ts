import { describe, it, expect, beforeEach } from 'vitest';
import { UserRepo } from '@/app/repositories/userRepo';
import { inviteUserSchema } from '@/lib/schemas';
import { db } from '@/lib/db';

describe('UserRepo (Integration)', () => {
  let owner: { id: string };

  beforeEach(async () => {
    owner = await db.user.create({
      data: { email: 'owner@example.com', name: 'Owner', role: 'OWNER', password: 'hash' },
    });
  });

  it('invites a Google-only user with a lowercased email and no password', async () => {
    const input = inviteUserSchema.parse({ email: '  Juan@Gmail.com ', name: 'Juan' });
    const user = await UserRepo.inviteUser(input);

    expect(user.email).toBe('juan@gmail.com');
    expect(user.role).toBe('PARTNER');
    expect(user.hasPassword).toBe(false);
    expect(user.providers).toEqual([]);
    // The hash is never part of the response
    expect(user).not.toHaveProperty('password');
  });

  it('stores a hashed password when one is given', async () => {
    const input = inviteUserSchema.parse({ email: 'pw@example.com', name: 'PW', password: 'longenough' });
    const user = await UserRepo.inviteUser(input);

    expect(user.hasPassword).toBe(true);
    const row = await db.user.findUnique({ where: { id: user.id } });
    expect(row?.password).not.toBe('longenough');
  });

  it('rejects inviting an email that already has access', async () => {
    const input = inviteUserSchema.parse({ email: 'OWNER@example.com', name: 'Dup' });
    await expect(UserRepo.inviteUser(input)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('changes another user\'s role but not your own', async () => {
    const partner = await UserRepo.inviteUser(inviteUserSchema.parse({ email: 'p@example.com', name: 'P' }));

    const updated = await UserRepo.updateRole(owner.id, partner.id, 'OWNER');
    expect(updated.role).toBe('OWNER');

    await expect(UserRepo.updateRole(owner.id, owner.id, 'PARTNER')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('removes a user but keeps their stock movements in the history', async () => {
    const partner = await UserRepo.inviteUser(inviteUserSchema.parse({ email: 'p@example.com', name: 'P' }));
    const product = await db.product.create({ data: { name: 'Shirt' } });
    const variant = await db.productVariant.create({ data: { productId: product.id, price: 100, currentStock: 5 } });
    const movement = await db.stockMovement.create({
      data: { variantId: variant.id, type: 'IN', quantity: 5, userId: partner.id },
    });

    await UserRepo.removeUser(owner.id, partner.id);

    expect(await db.user.findUnique({ where: { id: partner.id } })).toBeNull();
    const kept = await db.stockMovement.findUnique({ where: { id: movement.id } });
    expect(kept).not.toBeNull();
    expect(kept?.userId).toBeNull();
  });

  it('does not let you remove yourself', async () => {
    await expect(UserRepo.removeUser(owner.id, owner.id)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects an invite password shorter than 8 characters', () => {
    expect(inviteUserSchema.safeParse({ email: 'a@b.com', name: 'A', password: 'short' }).success).toBe(false);
    // An empty password means "Google only", not an error
    expect(inviteUserSchema.safeParse({ email: 'a@b.com', name: 'A', password: '' }).success).toBe(true);
  });
});
