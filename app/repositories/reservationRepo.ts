import { db } from '@/lib/db';
import { ApiError } from '@/lib/errors';
import type { Prisma, ReservationState } from '@prisma/client';

export class ReservationRepo {
  /**
   * Creates a reservation with row-level locking (SELECT FOR UPDATE) to prevent race conditions.
   */
  static async createReservation(
    data: { variantId: string; quantity: number; customerName?: string | null },
    userId: string
  ) {
    const { variantId, quantity, customerName } = data;

    return await db.$transaction(async (tx) => {
      // Row-level lock to prevent concurrent modifications
      const variants = await tx.$queryRaw<Array<{ currentStock: number; reservedStock: number }>>`
        SELECT "currentStock", "reservedStock" FROM product_variants WHERE id = ${variantId} FOR UPDATE
      `;
      const variant = variants[0];
      
      if (!variant) {
        throw new ApiError(404, "Product variant not found");
      }
      
      const availableStock = variant.currentStock - variant.reservedStock;
      if (availableStock < quantity) {
        throw new ApiError(422, `Insufficient stock. Available: ${availableStock}, Requested: ${quantity}`);
      }

      await tx.productVariant.update({
        where: { id: variantId },
        data: {
          reservedStock: { increment: quantity },
        },
      });

      return await tx.reservation.create({
        data: {
          variantId,
          quantity,
          state: 'RESERVED',
          customerName,
          updatedBy: userId,
        },
        include: { variant: { include: { product: true } }, user: true },
      });
    });
  }

  /**
   * Transitions a reservation state.
   */
  static async transitionState(
    id: string,
    action: "ship" | "deliver" | "release" | "return" | "cancel",
    userId: string,
    options?: { restock?: boolean }
  ) {
    return await db.$transaction(async (tx) => {
      const raw = await tx.$queryRaw<Array<{id: string, state: ReservationState, quantity: number, variantId: string, currentStock: number, reservedStock: number, price: number, costPrice: number}>>`
        SELECT r.id, r.state, r.quantity, r."variantId",
               v."currentStock", v."reservedStock", v.price, v."costPrice"
        FROM reservations r
        JOIN product_variants v ON v.id = r."variantId"
        WHERE r.id = ${id}
        FOR UPDATE
      `;

      if (!raw.length) {
        throw new ApiError(404, 'Reservation not found');
      }

      const row = raw[0];
      const reservation = {
        id: row.id,
        state: row.state,
        quantity: row.quantity,
        variantId: row.variantId,
        variant: {
          price: row.price,
          costPrice: row.costPrice,
          currentStock: row.currentStock,
          reservedStock: row.reservedStock,
        },
      };

      const { state, quantity, variantId, variant } = reservation;
      const now = new Date();

      if (['RELEASED', 'RETURNED', 'CANCELLED', 'SHIPPED'].includes(state) && action !== 'return') {
         // Terminal states can't be transitioned out of, except SHIPPED -> RETURNED
         throw new ApiError(400, `Cannot transition from terminal state: ${state}`);
      }

      let nextState: ReservationState;
      const updateData: Record<string, unknown> = { updatedBy: userId };
      
      switch (action) {
        case "ship":
          if (state !== 'RESERVED') throw new ApiError(400, "Can only ship from RESERVED state");
          nextState = 'SHIPPING';
          updateData.shippingAt = now;
          break;
          
        case "deliver":
          if (state !== 'SHIPPING') throw new ApiError(400, "Can only deliver from SHIPPING state");
          nextState = 'SHIPPED';
          updateData.shippedAt = now;
          
          await tx.productVariant.update({
            where: { id: variantId },
            data: {
              currentStock: { decrement: quantity },
              reservedStock: { decrement: quantity },
            },
          });
          
          await tx.stockMovement.create({
            data: {
              variantId,
              type: 'OUT',
              quantity,
              priceAtMovement: variant.price,
              costPriceAtMovement: variant.costPrice,
              note: `Reservation #${id}`,
              userId,
            },
          });
          break;
          
        case "release":
          if (state !== 'RESERVED' && state !== 'SHIPPING') throw new ApiError(400, "Can only release from RESERVED or SHIPPING state");
          nextState = 'RELEASED';
          updateData.releasedAt = now;
          
          await tx.productVariant.update({
            where: { id: variantId },
            data: {
              reservedStock: { decrement: quantity },
            },
          });
          break;
          
        case "return":
          if (state !== 'SHIPPED') throw new ApiError(400, "Can only return from SHIPPED state");
          nextState = 'RETURNED';
          updateData.returnedAt = now;
          
          if (options?.restock) {
            await tx.productVariant.update({
              where: { id: variantId },
              data: {
                currentStock: { increment: quantity },
              },
            });
            
            await tx.stockMovement.create({
              data: {
                variantId,
                type: 'IN',
                quantity,
                priceAtMovement: variant.price,
                costPriceAtMovement: variant.costPrice,
                note: `Return from Reservation #${id}`,
                userId,
              },
            });
          }
          break;
          
        case "cancel":
          if (['RELEASED', 'RETURNED', 'CANCELLED', 'SHIPPED'].includes(state)) {
            throw new ApiError(400, "Cannot cancel from terminal states or SHIPPED state");
          }
          nextState = 'CANCELLED';
          updateData.cancelledAt = now;
          
          if (state === 'RESERVED' || state === 'SHIPPING') {
            await tx.productVariant.update({
              where: { id: variantId },
              data: {
                reservedStock: { decrement: quantity },
              },
            });
          }
          break;
          
        default:
          throw new ApiError(400, "Invalid action");
      }

      updateData.state = nextState;

      return await tx.reservation.update({
        where: { id },
        data: updateData,
        include: { variant: { include: { product: true } }, user: true },
      });
    });
  }

  /**
   * Get filtered, paginated reservations.
   */
  static async getReservations(filters: {
    state?: ReservationState;
    variantId?: string;
    startDate?: string | null;
    endDate?: string | null;
    customerName?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 30));

    const where: Prisma.ReservationWhereInput = {
      ...(filters.state && { state: filters.state }),
      ...(filters.variantId && { variantId: filters.variantId }),
      ...(filters.customerName && { customerName: { contains: filters.customerName, mode: 'insensitive' } }),
      ...((filters.startDate || filters.endDate) && {
        reservedAt: {
          ...(filters.startDate && { gte: new Date(filters.startDate) }),
          ...(filters.endDate && { lte: new Date(filters.endDate) }),
        },
      }),
    };

    const [reservations, total] = await db.$transaction([
      db.reservation.findMany({
        where,
        include: { variant: { include: { product: true } }, user: true },
        orderBy: { reservedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.reservation.count({ where }),
    ]);

    return {
      data: reservations,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Returns stock info for a variant.
   */
  static async getAvailableStock(variantId: string) {
    const variant = await db.productVariant.findUnique({
      where: { id: variantId },
      select: { currentStock: true, reservedStock: true },
    });
    
    if (!variant) {
      throw new ApiError(404, 'Variant not found');
    }
    
    return {
      currentStock: variant.currentStock,
      reservedStock: variant.reservedStock,
      availableStock: variant.currentStock - variant.reservedStock,
    };
  }
}
