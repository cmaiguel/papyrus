/**
 * Simple in-memory rate limiter for Next.js API routes.
 * Resets per-process — suitable for Vercel serverless (each instance has its own store).
 *
 * Usage:
 *   const result = rateLimit(request.ip ?? "unknown", { requests: 20, windowMs: 60_000 });
 *   if (!result.ok) return new Response("Rate limit exceeded", { status: 429 });
 */

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

// Prune stale entries every 5 minutes to prevent unbounded memory growth
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, 300_000);
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetInMs: number;
}

export function rateLimit(
  identifier: string,
  opts: { requests: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry || now > entry.resetAt) {
    store.set(identifier, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, remaining: opts.requests - 1, resetInMs: opts.windowMs };
  }

  if (entry.count >= opts.requests) {
    return { ok: false, remaining: 0, resetInMs: entry.resetAt - now };
  }

  entry.count++;
  return { ok: true, remaining: opts.requests - entry.count, resetInMs: entry.resetAt - now };
}

/** Extract a stable identifier from a Next.js request (IP or fallback). */
export function getRequestId(request: Request): string {
  const forwarded = (request.headers as Headers).get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = (request.headers as Headers).get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}
