import { Prisma } from "@prisma/client";

// Centralized Prisma error codes
export const PRISMA_ERRORS = {
  UNIQUE_CONSTRAINT: "P2002",
  NOT_FOUND: "P2025",
  FK_CONSTRAINT: "P2003",
} as const;

// Typed API error for structured error responses
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Validation error for Zod failures
export class ValidationError extends ApiError {
  constructor(details: Record<string, unknown>) {
    super(400, "Validation failed", details);
    this.name = "ValidationError";
  }
}

// Check if error is a known Prisma client error
function isPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

// Extract field name from Prisma unique constraint error
function getUniqueFieldName(error: Prisma.PrismaClientKnownRequestError): string {
  const target = error.meta?.target as string[] | undefined;
  if (Array.isArray(target) && target.length > 0) {
    return target[0];
  }
  return "field";
}

// Convert unknown errors to structured ApiError
export function handlePrismaError(error: unknown): ApiError {
  if (isPrismaError(error)) {
    switch (error.code) {
      case PRISMA_ERRORS.UNIQUE_CONSTRAINT: {
        const field = getUniqueFieldName(error);
        return new ApiError(409, `${field} already exists`);
      }
      case PRISMA_ERRORS.NOT_FOUND:
        return new ApiError(404, "Record not found");
      case PRISMA_ERRORS.FK_CONSTRAINT:
        return new ApiError(409, "Foreign key constraint failed: related record missing or still in use");
      default:
        return new ApiError(500, "Database error");
    }
  }

  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError(500, "Unexpected error");
}
