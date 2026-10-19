import { NextRequest, NextResponse } from "next/server";
import { ZodSchema } from "zod";
import { ApiError, ValidationError, handlePrismaError } from "./errors";

// Generic route handler that works with any params type
export function withErrorHandler<TContext extends { params: Promise<unknown> }>(
  handler: (req: NextRequest, context: TContext) => Promise<Response>
): (req: NextRequest, context: TContext) => Promise<Response> {
  return async (req, context) => {
    try {
      return await handler(req, context);
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json(
          { error: error.message, details: error.details },
          { status: error.statusCode }
        );
      }

      const apiError = handlePrismaError(error);
      console.error("[API Error]", error);

      return NextResponse.json(
        { error: apiError.message },
        { status: apiError.statusCode }
      );
    }
  };
}

// Validation helper that throws ValidationError on failure
export function withValidation<T>(schema: ZodSchema<T>) {
  return (data: unknown): T => {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new ValidationError(result.error.format() as Record<string, unknown>);
    }
    return result.data;
  };
}

// Parse and validate JSON body from request
export async function parseBody<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
  return withValidation(schema)(json);
}
