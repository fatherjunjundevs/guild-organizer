"use client";

import { useActionState, useState } from "react";
import {
  createMemberInviteAction,
  regenerateInviteAction,
  revokeInviteAction,
  type InviteMutationState,
} from "@/features/invites/management-actions";
import type { ManagedGuildInvite } from "@/features/invites/server";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";

const initialInviteMutationState: InviteMutationState = {
  status: "idle",
  message: "",
};

function getDisplayStatus(invite: ManagedGuildInvite) {
  if (invite.status === "revoked") {
    return {
      label: "Revoked",
      tone: "danger" as const,
    };
  }

  if (invite.isExpired) {
    return {
      label: "Expired",
      tone: "warning" as const,
    };
  }

  return {
    label: "Active",
    tone: "success" as const,
  };
}

function formatRole(role: ManagedGuildInvite["role"]) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function CopyableInviteLink({
  state,
}: {
  state: InviteMutationState;
}) {
  const [copied, setCopied] = useState(false);

  if (state.status === "idle") {
    return null;
  }

  if (state.status === "error") {
    return (
      <p className="mt-3 text-sm text-[var(--danger)]">
        {state.message}
      </p>
    );
  }

  if (!state.url) {
    return (
      <p className="mt-3 text-sm text-[var(--success)]">
        {state.message}
      </p>
    );
  }

  async function copyLink() {
    if (!state.url) {
      return;
    }

    try {
      await navigator.clipboard.writeText(state.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4">
      <p className="text-sm font-semibold text-[var(--accent)]">
        {state.message}
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          aria-label="Generated invitation link"
          readOnly
          value={state.url}
          onFocus={(event) => event.currentTarget.select()}
          className="h-10 min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm text-[var(--text-primary)]"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={copyLink}
        >
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>

      <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">
        This exact URL is intentionally not stored in the database. If
        you lose it, regenerate the invitation.
      </p>
    </div>
  );
}

function ManagedInviteRow({
  guildId,
  invite,
}: {
  guildId: string;
  invite: ManagedGuildInvite;
}) {
  const [regenerateState, regenerateAction, regeneratePending] =
    useActionState(
      regenerateInviteAction,
      initialInviteMutationState,
    );
  const [revokeState, revokeAction, revokePending] = useActionState(
    revokeInviteAction,
    initialInviteMutationState,
  );

  const displayStatus = getDisplayStatus(invite);
  const isRevoked = invite.status === "revoked";
  const isExpired = !isRevoked && invite.isExpired;

  return (
    <Surface level={2} className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">
              {formatRole(invite.role)} invitation
            </p>
            <StatusChip tone={displayStatus.tone}>
              {displayStatus.label}
            </StatusChip>
            {invite.inviteKind === "elevated" ? (
              <StatusChip tone="warning">Single use</StatusChip>
            ) : (
              <StatusChip tone="neutral">Reusable</StatusChip>
            )}
          </div>

          <div className="mt-2 space-y-1 text-sm text-[var(--text-tertiary)]">
            <p>Generation {invite.generation}</p>
            <p>
              Uses: {invite.useCount}
              {invite.maxUses === null ? "" : ` / ${invite.maxUses}`}
            </p>
            <p>
              Expires {new Date(invite.expiresAt).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <form action={regenerateAction}>
            <input type="hidden" name="guildId" value={guildId} />
            <input
              type="hidden"
              name="inviteId"
              value={invite.inviteId}
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={regeneratePending}
            >
              {regeneratePending
                ? "Generating…"
                : isRevoked || isExpired
                  ? "Generate fresh link"
                  : "Regenerate"}
            </Button>
          </form>

          {!isRevoked ? (
            <form action={revokeAction}>
              <input type="hidden" name="guildId" value={guildId} />
              <input
                type="hidden"
                name="inviteId"
                value={invite.inviteId}
              />
              <Button
                type="submit"
                variant="danger"
                disabled={revokePending}
              >
                {revokePending ? "Revoking…" : "Revoke"}
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      <CopyableInviteLink state={regenerateState} />
      <CopyableInviteLink state={revokeState} />
    </Surface>
  );
}

export function InviteManager({
  guildId,
  invites,
}: {
  guildId: string;
  invites: ManagedGuildInvite[];
}) {
  const [createState, createAction, createPending] = useActionState(
    createMemberInviteAction,
    initialInviteMutationState,
  );

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-[var(--guild-accent)] uppercase">
            Guild Access
          </p>
          <h2 className="mt-2 text-2xl font-semibold">
            Invitation management
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
            Member links are reusable for 30 days. Elevated Officer and
            Admin invitations are single-use. Raw invitation links are
            never stored, so copy a newly generated link immediately.
          </p>
        </div>

        <form action={createAction}>
          <input type="hidden" name="guildId" value={guildId} />
          <Button type="submit" size="lg" disabled={createPending}>
            {createPending ? "Generating…" : "Generate Member Invite"}
          </Button>
        </form>
      </div>

      <CopyableInviteLink state={createState} />

      <div className="mt-6">
        <h3 className="text-sm font-semibold tracking-[0.12em] text-[var(--text-tertiary)] uppercase">
          Managed invitations
        </h3>

        {invites.length > 0 ? (
          <div className="mt-3 grid gap-3">
            {invites.map((invite) => (
              <ManagedInviteRow
                key={invite.inviteId}
                guildId={guildId}
                invite={invite}
              />
            ))}
          </div>
        ) : (
          <Surface level={2} className="mt-3 p-5">
            <p className="font-semibold">No invitations yet</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Generate a Member invite to create the first shareable
              Guild access link.
            </p>
          </Surface>
        )}
      </div>
    </section>
  );
}
