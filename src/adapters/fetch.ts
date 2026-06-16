import { withRetry, parseRetryAfter } from "../core/retry";
import { RetryOptions, GuardianResponse } from "../core/types";

export interface FetchGuardianOptions extends RetryOptions {
  fetchOptions?: RequestInit;
}

/**
 * Wraps native fetch with automatic retries, exponential backoff,
 * and Retry-After header support for 429 responses.
 */
export async function guardedFetch<T = unknown>(
  url: string,
  options: FetchGuardianOptions = {}
): Promise<GuardianResponse<T>> {
  const { fetchOptions, ...retryOptions } = options;

  return withRetry(async (attempt) => {
    const res = await fetch(url, fetchOptions);

    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key] = value;
    });

    let data: T;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = (await res.json()) as T;
    } else {
      data = (await res.text()) as unknown as T;
    }

    const retryAfter = parseRetryAfter(res.headers.get("retry-after"));

    return {
      data,
      status: res.status,
      headers,
      attempts: attempt + 1,
      retryAfter,
    };
  }, retryOptions);
}