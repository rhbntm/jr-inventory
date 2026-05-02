// Simple in-memory rate limiter for login attempts
// For production with multiple instances, use Redis instead

type RateLimitEntry = {
  attempts: number;
  firstAttempt: number;
  blocked: boolean;
};

const attempts = new Map<string, RateLimitEntry>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const BLOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes block

export function checkRateLimit(identifier: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const entry = attempts.get(identifier);

  // Clean up old entries
  if (entry && now - entry.firstAttempt > WINDOW_MS && !entry.blocked) {
    attempts.delete(identifier);
  }

  // Check if currently blocked
  if (entry?.blocked) {
    const blockExpires = entry.firstAttempt + BLOCK_DURATION_MS;
    if (now < blockExpires) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: blockExpires,
      };
    }
    // Block expired, reset
    attempts.delete(identifier);
  }

  const current = attempts.get(identifier);
  if (!current) {
    return {
      allowed: true,
      remaining: MAX_ATTEMPTS - 1,
      resetAt: now + WINDOW_MS,
    };
  }

  const remaining = Math.max(0, MAX_ATTEMPTS - current.attempts);

  return {
    allowed: remaining > 0,
    remaining,
    resetAt: current.firstAttempt + WINDOW_MS,
  };
}

export function recordFailedAttempt(identifier: string): void {
  const now = Date.now();
  const current = attempts.get(identifier);

  if (!current) {
    attempts.set(identifier, {
      attempts: 1,
      firstAttempt: now,
      blocked: false,
    });
    return;
  }

  current.attempts++;

  if (current.attempts >= MAX_ATTEMPTS) {
    current.blocked = true;
    current.firstAttempt = now; // Reset timestamp to block start time
  }
}

export function resetRateLimit(identifier: string): void {
  attempts.delete(identifier);
}
