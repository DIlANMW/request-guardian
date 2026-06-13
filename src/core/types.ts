export interface RetryOptions {
  /** Max number of retry attempts (not counting the initial try) */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff */
  baseDelay?: number;
  /** Max delay cap in ms */
  maxDelay?: number;
  /** Add random jitter to avoid thundering herd */
  jitter?: boolean;
  /** HTTP status codes that should trigger a retry */
  retryStatusCodes?: number[];
  /** Called before each retry attempt, useful for logging */
  onRetry?: (info: RetryInfo) => void;
}

export interface RetryInfo {
  attempt: number;
  error: unknown;
  delay: number;
  status?: number;
}

export interface GuardianResponse<T = unknown> {
  data: T;
  status: number;
  headers: Record<string, string>;
  attempts: number;
}