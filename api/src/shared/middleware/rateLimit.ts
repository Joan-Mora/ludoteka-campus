import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors";

type Bucket = { count: number; resetAt: number };

/** In-memory sliding window rate limit (lab/MVP). Keyed by IP + route. */
export function rateLimit(opts: { windowMs: number; max: number; keyPrefix: string }) {
  const buckets = new Map<string, Bucket>();

  return (req: Request, _res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${opts.keyPrefix}:${ip}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > opts.max) {
      next(
        new AppError(
          429,
          "RATE_LIMITED",
          "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
        ),
      );
      return;
    }
    next();
  };
}