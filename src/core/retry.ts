import { RetryOptions, RetryInfo } from "./types";

export const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "onRetry">> = {
  maxRetries: 3,
  baseDelay: 300,
  maxDelay: 10000,
  jitter: true,
  retryStatusCodes: [408, 429, 500, 502, 503, 504],
};

/**
 * Calculates delay for a given attempt using exponential backoff.
 * Formula: min(baseDelay * 2^attempt, maxDelay) + optional jitter
 */
export function calculateDelay(
  attempt: number,
  options: Required<Omit<RetryOptions, "onRetry">>
): number {
  const exponential = options.baseDelay * Math.pow(2, attempt);
  const capped = Math.min(exponential, options.maxDelay);

  if (options.jitter) {
    // Add random jitter between 0 and capped delay (full jitter strategy)
    return Math.floor(Math.random() * capped);
  }

  return capped;
}

/**
 * Reads a Retry-After header value (seconds or HTTP date) and converts to ms.
 * Returns null if header is missing or unparsable.
 */
export function parseRetryAfter(headerValue: string | null): number | null {
  if (!headerValue) return null;

  const seconds = Number(headerValue);
  if (!Number.isNaN(seconds)) {
    return seconds * 1000;
  }

  const date = new Date(headerValue).getTime();
  if (!Number.isNaN(date)) {
    const diff = date - Date.now();
    return diff > 0 ? diff : 0;
  }

  return null;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generic retry wrapper. Takes a function that performs one attempt
 * and returns a result with a status field.
 * Retries based on status code or thrown error, with exponential backoff.
 */
export async function withRetry<T extends { status?: number; retryAfter?: number | null }>(
  fn: (attempt: number) => Promise<T>,
  userOptions: RetryOptions = {}
): Promise<T> {
  const options: Required<Omit<RetryOptions, "onRetry">> = {
    ...DEFAULT_OPTIONS,
    ...userOptions,
  };

  let lastError: unknown;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      const result = await fn(attempt);

      const status = result.status;
      const shouldRetry =
        status !== undefined && options.retryStatusCodes.includes(status);

      if (!shouldRetry || attempt === options.maxRetries) {
        return result;
      }

      // Prefer Retry-After header if present, else exponential backoff
      const delay =
        result.retryAfter ?? calculateDelay(attempt, options);

      userOptions.onRetry?.({ attempt, error: null, delay, status });
      await sleep(delay);
    } catch (err) {
      lastError = err;

      if (attempt === options.maxRetries) {
        throw err;
      }

      const delay = calculateDelay(attempt, options);
      userOptions.onRetry?.({ attempt, error: err, delay });
      await sleep(delay);
    }
  }

  throw lastError;
}