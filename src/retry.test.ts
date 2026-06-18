import { describe, it, expect, vi, afterEach } from "vitest";
import { calculateDelay, parseRetryAfter, withRetry, sleep } from "./core/retry";

// ─── calculateDelay ───────────────────────────────────────────────────────────

describe("calculateDelay", () => {
  const baseOptions = {
    baseDelay: 300,
    maxDelay: 10000,
    jitter: false,
    maxRetries: 3,
    retryStatusCodes: [429, 500],
  };

  it("doubles delay on each attempt", () => {
    expect(calculateDelay(0, baseOptions)).toBe(300);
    expect(calculateDelay(1, baseOptions)).toBe(600);
    expect(calculateDelay(2, baseOptions)).toBe(1200);
  });

  it("caps at maxDelay", () => {
    expect(calculateDelay(10, baseOptions)).toBe(10000);
  });

  it("returns value within range when jitter is enabled", () => {
    const delay = calculateDelay(1, { ...baseOptions, jitter: true });
    expect(delay).toBeGreaterThanOrEqual(0);
    expect(delay).toBeLessThanOrEqual(600);
  });
});

// ─── parseRetryAfter ──────────────────────────────────────────────────────────

describe("parseRetryAfter", () => {
  it("parses seconds value", () => {
    expect(parseRetryAfter("5")).toBe(5000);
  });

  it("parses HTTP date string", () => {
    const future = new Date(Date.now() + 10000).toUTCString();
    const result = parseRetryAfter(future);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(10000);
  });

  it("returns null for null input", () => {
    expect(parseRetryAfter(null)).toBeNull();
  });

  it("returns null for garbage input", () => {
    expect(parseRetryAfter("not-a-date")).toBeNull();
  });
});

// ─── sleep ────────────────────────────────────────────────────────────────────

describe("sleep", () => {
  it("resolves after the given ms", async () => {
    const start = Date.now();
    await sleep(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(45);
  });
});

// ─── withRetry ────────────────────────────────────────────────────────────────

describe("withRetry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns immediately on success", async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockResolvedValue({ status: 200, data: "ok" });

    const promise = withRetry(fn, { maxRetries: 3, baseDelay: 100, jitter: false });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fn).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(200);
  });

  it("retries on retryable status code", async () => {
    vi.useFakeTimers();
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ status: 500 })
      .mockResolvedValueOnce({ status: 500 })
      .mockResolvedValue({ status: 200, data: "ok" });

    const promise = withRetry(fn, { maxRetries: 3, baseDelay: 100, jitter: false });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fn).toHaveBeenCalledTimes(3);
    expect(result.status).toBe(200);
  });

  it("retries on thrown error then succeeds", async () => {
    vi.useFakeTimers();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValue({ status: 200, data: "ok" });

    const promise = withRetry(fn, { maxRetries: 3, baseDelay: 100, jitter: false });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fn).toHaveBeenCalledTimes(2);
    expect(result.status).toBe(200);
  });

  it("throws after maxRetries exhausted", async () => {
    // Use real timers with a tiny delay to avoid unhandled rejection issues
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("always fails"))
      .mockRejectedValueOnce(new Error("always fails"))
      .mockRejectedValue(new Error("always fails"));

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelay: 1, jitter: false })
    ).rejects.toThrow("always fails");

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("calls onRetry with correct info", async () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ status: 500 })
      .mockResolvedValue({ status: 200 });

    const promise = withRetry(fn, {
      maxRetries: 3,
      baseDelay: 100,
      jitter: false,
      onRetry,
    });
    await vi.runAllTimersAsync();
    await promise;

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 0, status: 500 })
    );
  });

  it("respects retryAfter delay from response", async () => {
    vi.useFakeTimers();
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ status: 429, retryAfter: 2000 })
      .mockResolvedValue({ status: 200, data: "ok" });

    const advanceSpy = vi.spyOn(globalThis, "setTimeout");

    const promise = withRetry(fn, { maxRetries: 3, baseDelay: 100, jitter: false });
    await vi.runAllTimersAsync();
    await promise;

    const delays = advanceSpy.mock.calls.map((c) => c[1]);
    expect(delays).toContain(2000);
  });
});