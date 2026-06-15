import { RetryInfo } from "../core/types";

export interface LogContext {
  url?: string;
  method?: string;
  [key: string]: unknown;
}

/**
 * Default logger prints structured info about retries and failures
 * to the console. Pass your own function via onRetry to override.
 */
export function defaultRetryLogger(info: RetryInfo, context: LogContext = {}): void {
  const { attempt, status, error, delay } = info;

  const base = `[request-guardian] attempt ${attempt + 1} failed`;
  const ctx = context.url ? ` for ${context.method ?? "GET"} ${context.url}` : "";

  if (status !== undefined) {
    console.warn(`${base}${ctx} — status ${status}. Retrying in ${delay}ms...`);
  } else {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`${base}${ctx} — error: ${message}. Retrying in ${delay}ms...`);
  }
}

/**
 * Logs a final failure (after all retries exhausted) with full context.
 */
export function logFinalFailure(
  info: { attempts: number; status?: number; error?: unknown },
  context: LogContext = {}
): void {
  const ctx = context.url ? ` ${context.method ?? "GET"} ${context.url}` : "";

  if (info.status !== undefined) {
    console.error(
      `[request-guardian] gave up${ctx} after ${info.attempts} attempt(s) — final status ${info.status}`
    );
  } else {
    const message = info.error instanceof Error ? info.error.message : String(info.error);
    console.error(
      `[request-guardian] gave up${ctx} after ${info.attempts} attempt(s) — ${message}`
    );
  }
}