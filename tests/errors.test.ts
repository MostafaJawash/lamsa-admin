import { describe, expect, it } from "vitest";

import {
  ApiError,
  errorMessage,
  fieldErrors,
  isApiErrorBody,
} from "@/lib/errors";
import { toApiError } from "@/lib/api/base";
import { m } from "@/messages";

describe("errorMessage", () => {
  it("prefers the backend Arabic message", () => {
    const error = new ApiError(
      409,
      "PHONE_TAKEN",
      "رقم الهاتف مستخدم في حساب آخر.",
    );
    expect(errorMessage(error)).toBe("رقم الهاتف مستخدم في حساب آخر.");
  });

  it("falls back to the catalog by code when the backend sent no message", () => {
    expect(errorMessage(new ApiError(403, "ADMIN_ONLY", null))).toBe(
      m.errors.byCode.ADMIN_ONLY,
    );
  });

  it("has dedicated texts for network failures and timeouts", () => {
    expect(errorMessage(new ApiError(0, "NETWORK_ERROR", null))).toBe(
      m.errors.network,
    );
    expect(errorMessage(new ApiError(0, "TIMEOUT", null))).toBe(
      m.errors.timeout,
    );
  });

  it("uses the generic text for unknown codes and non-API errors", () => {
    expect(errorMessage(new ApiError(418, "TEAPOT", null))).toBe(
      m.errors.unknown,
    );
    expect(errorMessage(new Error("boom"))).toBe(m.errors.unknown);
  });
});

describe("toApiError", () => {
  it("maps the backend error body, including details and Retry-After", () => {
    const response = new Response(null, {
      status: 429,
      headers: { "Retry-After": "30" },
    });
    const error = toApiError(response, {
      error: {
        code: "TOO_MANY_ATTEMPTS",
        message: "محاولات كثيرة.",
        details: { retry_after: 30 },
      },
    });
    expect(error).toMatchObject({
      status: 429,
      code: "TOO_MANY_ATTEMPTS",
      serverMessage: "محاولات كثيرة.",
      retryAfter: 30,
    });
  });

  it("falls back to HTTP_ERROR for a body that is not the backend shape", () => {
    const error = toApiError(
      new Response(null, { status: 502 }),
      "<html>bad gateway</html>",
    );
    expect(error.code).toBe("HTTP_ERROR");
    expect(error.status).toBe(502);
    expect(isApiErrorBody("<html>")).toBe(false);
  });
});

describe("fieldErrors", () => {
  it("reads VALIDATION_ERROR details as field/message pairs", () => {
    const error = new ApiError(422, "VALIDATION_ERROR", null, [
      { field: "body.phone", message: "غير صالح" },
      { nonsense: true },
    ]);
    expect(fieldErrors(error)).toEqual([
      { field: "body.phone", message: "غير صالح" },
    ]);
  });
});
