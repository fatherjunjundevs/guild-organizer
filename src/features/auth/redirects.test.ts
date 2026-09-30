import { describe, expect, it } from "vitest";
import {
  DEFAULT_AFTER_AUTH_PATH,
  getSafeNextPath,
} from "@/features/auth/redirects";

describe("getSafeNextPath", () => {
  it("accepts a local path", () => {
    expect(getSafeNextPath("/app/guild/abc/dashboard")).toBe(
      "/app/guild/abc/dashboard",
    );
  });

  it("preserves query strings and fragments", () => {
    expect(getSafeNextPath("/events?tab=mine#today")).toBe(
      "/events?tab=mine#today",
    );
  });

  it("rejects an absolute external URL", () => {
    expect(getSafeNextPath("https://example.com/phishing")).toBe(
      DEFAULT_AFTER_AUTH_PATH,
    );
  });

  it("rejects a protocol-relative external URL", () => {
    expect(getSafeNextPath("//example.com/phishing")).toBe(
      DEFAULT_AFTER_AUTH_PATH,
    );
  });

  it("uses the provided fallback for missing values", () => {
    expect(getSafeNextPath(null, "/login")).toBe("/login");
  });
});
