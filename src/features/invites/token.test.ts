import { describe, expect, it } from "vitest";
import {
  buildInvitePath,
  createSignedInviteToken,
  digestInviteToken,
  verifySignedInviteToken,
} from "@/features/invites/token";

const SIGNING_SECRET =
  "test-invite-signing-secret-that-is-long-enough";

describe("invite tokens", () => {
  it("creates a signed token that verifies", () => {
    const token = createSignedInviteToken(SIGNING_SECRET);

    expect(verifySignedInviteToken(token, SIGNING_SECRET)).toBe(true);
  });

  it("rejects a token signed with another secret", () => {
    const token = createSignedInviteToken(SIGNING_SECRET);

    expect(
      verifySignedInviteToken(
        token,
        "another-test-signing-secret-that-is-long-enough",
      ),
    ).toBe(false);
  });

  it("rejects a tampered token", () => {
    const token = createSignedInviteToken(SIGNING_SECRET);
    const [version, secretPart, signature] = token.split(".");
    const tamperedSecret =
      `${secretPart.slice(0, -1)}${secretPart.endsWith("A") ? "B" : "A"}`;

    expect(
      verifySignedInviteToken(
        `${version}.${tamperedSecret}.${signature}`,
        SIGNING_SECRET,
      ),
    ).toBe(false);
  });

  it("creates a lowercase SHA-256 digest for database storage", () => {
    const token = createSignedInviteToken(SIGNING_SECRET);

    expect(digestInviteToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("builds an invite route with its generation", () => {
    expect(buildInvitePath(3, "v1.secret.signature")).toBe(
      "/join/3/v1.secret.signature",
    );
  });

  it("rejects invalid generations", () => {
    expect(() => buildInvitePath(0, "token")).toThrow(
      "Invite generation must be a positive integer.",
    );
  });
});
