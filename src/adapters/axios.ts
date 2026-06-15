import type { AxiosInstance, AxiosRequestConfig, AxiosError } from "axios";
import { withRetry, parseRetryAfter } from "../core/retry";
import { RetryOptions, GuardianResponse } from "../core/types";

export interface AxiosGuardianOptions extends RetryOptions {
  /** An axios instance, or pass nothing to use axios's default export */
  axiosInstance?: AxiosInstance;
}

/**
 * Wraps an axios request with automatic retries, exponential backoff,
 * and Retry-After header support.
 *
 * Note: axios is a peer dependency,if it's not installed, this function
 * will throw a clear error when called (not at import time).
 */
export async function guardedAxios<T = unknown>(
  config: AxiosRequestConfig,
  options: AxiosGuardianOptions = {}
): Promise<GuardianResponse<T>> {
  const { axiosInstance, ...retryOptions } = options;

  let client: AxiosInstance;
  if (axiosInstance) {
    client = axiosInstance;
  } else {
    try {
      // Lazy require so axios stays optional at runtime
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const axiosModule = require("axios");
      client = axiosModule.default ?? axiosModule;
    } catch {
      throw new Error(
        "request-guardian: axios is not installed. Run `npm install axios` to use guardedAxios, or pass an axiosInstance."
      );
    }
  }

  return withRetry(async (attempt) => {
    try {
      const res = await client.request<T>(config);

      const retryAfter = parseRetryAfter(
        (res.headers["retry-after"] as string) ?? null
      );

      return {
        data: res.data,
        status: res.status,
        headers: res.headers as Record<string, string>,
        attempts: attempt + 1,
        retryAfter,
      };
    } catch (err) {
      const axiosErr = err as AxiosError;

      // If axios got  429, 500 like, treat it as a result
      // so withRetry can decide whether to retry based on status code.
      if (axiosErr.response) {
        const retryAfter = parseRetryAfter(
          (axiosErr.response.headers["retry-after"] as string) ?? null
        );

        return {
          data: axiosErr.response.data as T,
          status: axiosErr.response.status,
          headers: axiosErr.response.headers as Record<string, string>,
          attempts: attempt + 1,
          retryAfter,
        };
      }

      // No response (network error, timeout) rethrow so withRetry
      // retries based on the catch branch instead.
      throw err;
    }
  }, retryOptions);
}