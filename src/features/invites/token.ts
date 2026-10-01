import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const TOKEN_VERSION = "v1";
const TOKEN_BYTES = 32;
const BASE64URL_32_BYTES = /^[A-Za-z0-9_-]{43}$/;

function signatureFor(secretPart: string, signingSecret: string) {
  return createHmac("sha256", signingSecret)
    .update(`guild-organizer.invite.${TOKEN_VERSION}:${secretPart}`)
    .digest("base64url");
}

export function createSignedInviteToken(signingSecret: string) {
  const secretPart = randomBytes(TOKEN_BYTES).toString("base64url");
  const signature = signatureFor(secretPart, signingSecret);

  return `${TOKEN_VERSION}.${secretPart}.${signature}`;
}

export function verifySignedInviteToken(
  token: string,
  signingSecret: string,
) {
  const [version, secretPart, signature, extra] = token.split(".");

  if (
    extra !== undefined ||
    version !== TOKEN_VERSION ||
    !BASE64URL_32_BYTES.test(secretPart ?? "") ||
    !BASE64URL_32_BYTES.test(signature ?? "")
  ) {
    return false;
  }

  const expected = Buffer.from(
    signatureFor(secretPart, signingSecret),
    "base64url",
  );
  const actual = Buffer.from(signature, "base64url");

  return (
    expected.length === actual.length &&
    timingSafeEqual(expected, actual)
  );
}

export function digestInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function buildInvitePath(generation: number, token: string) {
  if (!Number.isSafeInteger(generation) || generation <= 0) {
    throw new Error("Invite generation must be a positive integer.");
  }

  return `/join/${generation}/${encodeURIComponent(token)}`;
}
