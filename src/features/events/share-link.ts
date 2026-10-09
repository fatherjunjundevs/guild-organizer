// Safe DTOs only. Crypto/configuration and encrypted RPC material stay server-side.
export type ShareLinkOperation = "state" | "create" | "copy" | "rotate" | "revoke";
export type EventShareLinkState = { linkId: string | null; createdAt: string | null; available: boolean };
export type ShareLinkFailure = {
  ok: false; operation: ShareLinkOperation;
  code: "invalid" | "unauthenticated" | "forbidden" | "unavailable" | "configuration" |
    "recovery_failed" | "read_failed" | "conflict" | "mutation_failed" | "mutation_unknown";
  message: string;
  recovery: "none" | "read_state" | "retry_copy";
  requestedLinkId?: string;
};
export type ShareLinkStateResult = { ok: true; operation: "state"; state: EventShareLinkState } | ShareLinkFailure;
export type ShareLinkCopyResult = { ok: true; operation: "copy"; linkId: string; url: string } | ShareLinkFailure;
export type ShareLinkMutationResult = {
  ok: true; operation: "create" | "rotate" | "revoke"; outcome: "confirmed";
  requestedLinkId: string; state: EventShareLinkState | null;
  refresh: "ready" | "required"; message: string;
} | ShareLinkFailure;
