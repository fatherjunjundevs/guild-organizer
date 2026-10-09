"use client";

import { startTransition, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";
import { copyEventShareLinkAction, createEventShareLinkAction, readEventShareLinkAction,
  revokeEventShareLinkAction, rotateEventShareLinkAction } from "./share-link-actions";
import type { EventShareLinkManagementState, ShareLinkFailure } from "./share-link";

type Props = { guildId: string; eventId: string; eventName: string; archived?: boolean; disabled?: boolean };

function rejectedBeforeWrite(result: ShareLinkFailure) {
  // These codes are emitted before the existing operations submit a write.
  // Other failures may reflect changed state or a committed mutation.
  return result.code === "configuration" || result.code === "invalid" || result.code === "unauthenticated";
}

export function EventShareLinkManager(props: Props) {
  // Changing Guild/Event unmounts the session, discarding sensitive and async state.
  return <ShareLinkSession key={`${props.guildId}:${props.eventId}`} {...props} />;
}

function ShareLinkSession({ guildId, eventId, eventName, archived = false, disabled = false }: Props) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const manualField = useRef<HTMLInputElement>(null);
  const confirmationCancel = useRef<HTMLButtonElement>(null);
  const rotateTrigger = useRef<HTMLButtonElement>(null);
  const revokeTrigger = useRef<HTMLButtonElement>(null);
  const cancelledConfirmation = useRef<"rotate" | "revoke" | null>(null);
  const request = useRef(0);
  const mounted = useRef(true);
  const locked = useRef(false);
  const pendingWrite = useRef(false);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<EventShareLinkManagementState | null>(null);
  const [busy, setBusy] = useState(false);
  const [writePending, setWritePending] = useState(false);
  const [confirmation, setConfirmation] = useState<"rotate" | "revoke" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [manualUrl, setManualUrl] = useState("");

  useEffect(() => {
    mounted.current = true;
    const requests = request;
    return () => { mounted.current = false; requests.current++; };
  }, []);
  useEffect(() => {
    if (open) dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [open]);
  useEffect(() => {
    if (confirmation) confirmationCancel.current?.focus();
    else if (cancelledConfirmation.current) {
      const origin = cancelledConfirmation.current;
      cancelledConfirmation.current = null;
      (origin === "rotate" ? rotateTrigger : revokeTrigger).current?.focus();
    }
  }, [confirmation]);
  useEffect(() => {
    if (manualUrl) { manualField.current?.focus(); manualField.current?.select(); }
  }, [manualUrl]);

  function valid(ticket: number) { return mounted.current && dialog.current?.open && ticket === request.current; }
  function reset() {
    request.current++;
    cancelledConfirmation.current = null;
    locked.current = false;
    setOpen(false); setState(null); setBusy(false); setManualUrl("");
    setConfirmation(null); setError(""); setMessage("");
  }
  function dismiss() {
    reset(); dialog.current?.close(); trigger.current?.focus();
  }
  function begin() {
    const ticket = ++request.current;
    locked.current = true; setBusy(true); setManualUrl(""); setError(""); setMessage("");
    return ticket;
  }
  function finish(ticket: number) {
    if (valid(ticket)) { locked.current = false; setBusy(false); }
  }
  async function reload() {
    if (locked.current || pendingWrite.current) return;
    const ticket = begin(); setState(null);
    try {
      const result = await readEventShareLinkAction({ guildId, eventId });
      if (!valid(ticket)) return;
      if (result.ok) { setState(result.state); setMessage("Share-link status loaded."); }
      else setError(result.message);
    } catch {
      if (valid(ticket)) setError("Share-link status could not be loaded. Reload Status before continuing.");
    } finally { finish(ticket); }
  }
  function show() {
    reset(); setOpen(true); dialog.current?.showModal();
    if (pendingWrite.current) setError("A sharing change is still in progress. Reload Status when it finishes.");
    else startTransition(() => { void reload(); });
  }
  async function mutate(operation: "create" | "rotate" | "revoke") {
    if (!state || locked.current || pendingWrite.current || (operation !== "create" && state.state !== "active")) return;
    const current = state;
    const ticket = begin(); setConfirmation(null); setState(null);
    pendingWrite.current = true; setWritePending(true);
    try {
      const scope = { guildId, eventId };
      const result = operation === "create" ? await createEventShareLinkAction(scope)
        : operation === "rotate" ? await rotateEventShareLinkAction({ ...scope, linkId: current.linkId! })
        : await revokeEventShareLinkAction({ ...scope, linkId: current.linkId! });
      if (!valid(ticket)) return;
      if (!result.ok) {
        if (rejectedBeforeWrite(result)) setState(current);
        setError(result.message); return;
      }
      setState(result.state);
      setMessage(operation === "create" ? "Link created." : operation === "rotate" ? "Link rotated. Older links are invalid." : "Link revoked.");
      if (!result.state) setError("The change was confirmed, but status could not be refreshed. Reload Status; the change will not be repeated.");
    } catch {
      if (valid(ticket)) setError("The change has an unknown outcome. Reload Status before continuing; the change will not be repeated.");
    } finally {
      pendingWrite.current = false;
      if (mounted.current) setWritePending(false);
      finish(ticket);
    }
  }
  async function copy() {
    if (state?.state !== "active" || locked.current || pendingWrite.current) return;
    const identity = state.linkId;
    const ticket = begin();
    try {
      const result = await copyEventShareLinkAction({ guildId, eventId, linkId: identity });
      if (!valid(ticket)) return;
      if (!result.ok) { if (!rejectedBeforeWrite(result)) setState(null); setError(result.message); return; }
      if (result.linkId !== identity) { setState(null); setError("Link identity changed. Reload Status before copying."); return; }
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(result.url);
        if (valid(ticket)) setMessage("Development link copied. The public Event page is not available yet.");
      } catch {
        if (valid(ticket)) { setManualUrl(result.url); setMessage("Clipboard unavailable. Select and copy the temporary field below."); }
      }
    } catch {
      if (valid(ticket)) { setState(null); setError("The link could not be recovered. Reload Status before copying again."); }
    } finally { finish(ticket); }
  }
  function ask(operation: "rotate" | "revoke") {
    setManualUrl(""); setError(""); setMessage(""); setConfirmation(operation);
  }
  function cancelConfirmation() { cancelledConfirmation.current = confirmation; setConfirmation(null); }

  const blocked = busy || writePending;
  const label = !state ? "Status unknown" : state.state === "absent" ? "No link created"
    : state.state === "revoked" ? "Link revoked" : state.available ? "Active · published" : "Active · unavailable";
  const detail = !state ? "Reload Status to read the current link state."
    : state.state === "absent" ? "A share link has never been created for this Event."
    : state.state === "revoked" ? "Previous links were revoked. No active link exists."
    : state.available ? "The link points to the current published Event version."
    : "The link exists, but its publication cannot currently be viewed. The Event may be unpublished or archived.";

  return <>
    <Button ref={trigger} type="button" variant="secondary" disabled={disabled} onClick={show}>Share Link</Button>
    <dialog ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), [tabindex='0']"))
          .filter((element) => element.getClientRects().length > 0);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
      onCancel={(event) => { event.preventDefault(); if (confirmation) cancelConfirmation(); else dismiss(); }}
      onClose={() => { if (!dialog.current?.open) { reset(); trigger.current?.focus(); } }}
      className="m-auto max-h-[calc(100dvh-1.5rem)] w-[min(34rem,calc(100vw-1.5rem))] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-1)] p-0 text-[var(--text-primary)] shadow-2xl shadow-black/50 backdrop:bg-black/70">
      {open ? <div className="flex max-h-[calc(100dvh-1.5rem)] flex-col">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border-subtle)] p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wider text-[var(--accent)] uppercase">Sharing · Development</p>
            <h2 id={`${id}-title`} className="mt-2 text-xl font-semibold">{confirmation === "rotate" ? "Rotate share link?" : confirmation === "revoke" ? "Revoke share link?" : "Event share link"}</h2>
            <p className="mt-1 break-words text-sm text-[var(--text-secondary)]">{eventName}</p>
          </div>
          <Button type="button" variant="ghost" onClick={dismiss}>Close</Button>
        </div>
        <div className="min-h-0 overflow-y-auto p-5">
          {confirmation ? <>
            <p id={`${id}-description`} className="text-sm leading-6 text-[var(--text-secondary)]">{confirmation === "rotate"
              ? "Older Discord links will stop working. The replacement points to the current published Event version when available."
              : "The current link will permanently stop working. Revoking does not unpublish the Event or delete historical versions."}</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button ref={confirmationCancel} type="button" variant="secondary" onClick={cancelConfirmation}>Cancel</Button>
              <Button type="button" variant="danger" disabled={blocked} onClick={() => startTransition(() => { void mutate(confirmation); })}>{confirmation === "rotate" ? "Rotate Link now" : "Revoke Link now"}</Button>
            </div>
          </> : <>
            <p id={`${id}-description`} className="text-sm leading-6 text-[var(--text-secondary)]">Development only: the public Event page is not implemented. Copied links are not ready to send to members.</p>
            <Surface level={2} className="mt-4 p-4" aria-busy={busy}>
              <StatusChip tone={state?.state === "active" && state.available ? "success" : "neutral"}>{label}</StatusChip>
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{detail}</p>
              {state?.createdAt ? <p className="mt-2 text-xs text-[var(--text-tertiary)]">Created <time dateTime={state.createdAt}>{new Date(state.createdAt).toLocaleString()}</time></p> : null}
            </Surface>
            <p role="status" aria-live="polite" className="mt-3 text-sm text-[var(--text-secondary)]">{busy ? "Working…" : message}</p>
            {error ? <p role="alert" className="mt-3 text-sm leading-6 text-[var(--danger)]">{error}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {state && state.state !== "active" && !archived ? <Button type="button" disabled={blocked} onClick={() => startTransition(() => { void mutate("create"); })}>Create Link</Button> : null}
              {state?.state === "active" ? <>
                <Button type="button" disabled={blocked} onClick={() => startTransition(() => { void copy(); })}>Copy Link</Button>
                {!archived ? <Button ref={rotateTrigger} type="button" variant="secondary" disabled={blocked} onClick={() => ask("rotate")}>Rotate Link</Button> : null}
                <Button ref={revokeTrigger} type="button" variant="secondary" disabled={blocked} onClick={() => ask("revoke")}>Revoke Link</Button>
              </> : null}
              <Button type="button" variant="secondary" disabled={blocked} onClick={() => startTransition(() => { void reload(); })}>Reload Status</Button>
            </div>
            {manualUrl ? <div className="mt-5">
              <label htmlFor={`${id}-url`} className="text-sm font-semibold">Temporary development link</label>
              <input ref={manualField} id={`${id}-url`} type="text" readOnly value={manualUrl} autoComplete="off" spellCheck={false}
                onFocus={(event) => event.currentTarget.select()} aria-describedby={`${id}-copy-help`}
                className="mt-2 h-11 w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-sm" />
              <p id={`${id}-copy-help`} className="mt-2 text-xs text-[var(--text-secondary)]">Use Ctrl+C or Command+C, or your device&apos;s Copy command. This field clears when you close or reload.</p>
              <Button type="button" variant="ghost" className="mt-2" onClick={() => { setManualUrl(""); setMessage("Temporary link field cleared."); }}>Clear link field</Button>
            </div> : null}
          </>}
        </div>
      </div> : null}
    </dialog>
  </>;
}
