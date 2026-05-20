import { describe, it, expect } from 'vitest';
import { withValidation } from '@/lib/api-wrapper';
import { ApiError, ValidationError, handlePrismaError } from '@/lib/errors';
import { z } from 'zod';

describe('API Wrapper & Errors', () => {
  describe('ApiError class', () => {
    it('should create an ApiError with status code and message', () => {
      const error = new ApiError(404, 'Not found');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Not found');
      expect(error.name).toBe('ApiError');
    });

    it('should create an ApiError with details', () => {
      const details = { field: 'name', reason: 'required' };
      const error = new ApiError(400, 'Bad request', details);
      expect(error.details).toEqual(details);
    });
  });

  describe('ValidationError class', () => {
    it('should create a ValidationError with 400 status', () => {
      const details = { name: { _errors: ['Required'] } };
      const error = new ValidationError(details);
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Validation failed');
      expect(error.details).toEqual(details);
      expect(error.name).toBe('ValidationError');
    });
  });

  describe('withValidation function', () => {
    const testSchema = z.object({
      name: z.string().min(1),
      age: z.number().int().positive(),
    });

    it('should validate and return valid data', () => {
      const validate = withValidation(testSchema);
      const data = { name: 'Test', age: 25 };
      const result = validate(data);
      expect(result).toEqual(data);
    });

    it('should throw ValidationError for invalid data', () => {
      const validate = withValidation(testSchema);
      const invalidData = { name: '', age: -5 };
      expect(() => validate(invalidData)).toThrow(ValidationError);
    });
  });

  describe('handlePrismaError function', () => {
    it('should return ApiError for unknown errors', () => {
      const error = handlePrismaError(new Error('Something went wrong'));
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(500);
    });

    it('should return the same ApiError if input is already ApiError', () => {
      const originalError = new ApiError(403, 'Forbidden');
      const result = handlePrismaError(originalError);
      expect(result).toBe(originalError);
    });
  });
});
