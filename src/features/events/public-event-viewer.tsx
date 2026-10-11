"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { parsePublicLineup, publicTokenPattern, type ReadyLineup } from "./public-lineup";

type ViewState = "empty" | "loading" | "invalid" | "unavailable" | "connection" | "limited" | "updated" | "ready";
const messages: Record<Exclude<ViewState, "ready">, { title: string; detail: string }> = {
  empty: { title: "Your lineup starts with a shared link", detail: "Open the Event link your organizer sent you. No account is needed." },
  loading: { title: "Finding your published lineup…", detail: "Reading the current publication." },
  invalid: { title: "This link is incomplete", detail: "Ask your organizer for a fresh Event link." },
  unavailable: { title: "This lineup is unavailable", detail: "The Event may no longer be published, or its link may have changed. Ask your organizer for the current link." },
  connection: { title: "We couldn’t connect", detail: "Your lineup has not been loaded. Try again in a moment." },
  limited: { title: "Please pause for a moment", detail: "Too many requests. Wait a minute before trying again." },
  updated: { title: "A newer lineup is ready", detail: "Your organizer published an update. Load the current version before checking your assignment." },
};

// Read one bounded response. Neither response bodies nor fetch failures are logged.
async function readLineup(response: Response) {
  if (!response.body) throw new Error("Unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break;
      size += next.value.byteLength;
      if (size > 262144) throw new Error("Unavailable");
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return parsePublicLineup(JSON.parse(new TextDecoder().decode(bytes)));
  } finally { void reader.cancel().catch(() => {}); try { reader.releaseLock(); } catch { /* Aborted stream. */ } }
}

export function PublicEventViewer({ enabled }: { enabled: boolean }) {
  const bearer = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const ticket = useRef(0);
  const initialized = useRef(false);
  const results = useRef<HTMLParagraphElement>(null);
  const [state, setState] = useState<ViewState>("empty");
  const [lineup, setLineup] = useState<ReadyLineup | null>(null);
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => { if (lineup && activeSearch) results.current?.focus(); }, [lineup, activeSearch]);

  async function load(query: string, nextPage: number, version: number | null) {
    if (!bearer.current || !enabled) return;
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    const request = ++ticket.current;
    const timer = setTimeout(() => abort.abort(), 8000);
    setLineup(null); setState("loading");
    try {
      const response = await fetch("/api/share/event", { method: "POST", cache: "no-store", credentials: "omit",
        referrerPolicy: "no-referrer", headers: { "Content-Type": "application/json" }, signal: abort.signal,
        body: JSON.stringify({ token: bearer.current, search: query, page: nextPage, version }) });
      if (ticket.current !== request) return;
      if (response.status === 429) { setState("limited"); return; }
      if (response.status === 404) { bearer.current = null; setState("unavailable"); return; }
      if (!response.ok) { setState("connection"); return; }
      const data = await readLineup(response);
      if (ticket.current !== request) return;
      if (!data) { setState("connection"); return; }
      if (data.status === "updated") { setState("updated"); return; }
      setLineup(data); setActiveSearch(query); setPage(nextPage); setState("ready");
    } catch { if (ticket.current === request) setState("connection"); }
    finally { clearTimeout(timer); }
  }

  useEffect(() => {
    const requests = ticket;
    function consumeFragment() {
      const fragment = window.location.hash;
      // Remove all fragment/query content before validation or any network work.
      window.history.replaceState(null, "", window.location.pathname);
      if (fragment) {
        bearer.current = null; ticket.current++; controller.current?.abort();
        queueMicrotask(() => { setLineup(null); setSearch(""); setActiveSearch(""); setPage(0); });
        const value = fragment.startsWith("#token=") ? fragment.slice(7) : "";
        if (!publicTokenPattern.test(value)) queueMicrotask(() => setState("invalid"));
        else if (enabled) { bearer.current = value; queueMicrotask(() => { void load("", 0, null); }); }
      }
    }
    // Handle a second Discord link opened while this same page is already open.
    // React development effect replay must not consume the original twice.
    if (!initialized.current) { initialized.current = true; consumeFragment(); }
    const clear = () => { bearer.current = null; ticket.current++; controller.current?.abort(); setLineup(null); setSearch(""); setActiveSearch(""); setState("empty"); };
    const restored = (event: PageTransitionEvent) => { if (event.persisted) clear(); };
    window.addEventListener("hashchange", consumeFragment);
    window.addEventListener("pagehide", clear); window.addEventListener("pageshow", restored);
    return () => { requests.current++; controller.current?.abort(); window.removeEventListener("hashchange", consumeFragment); window.removeEventListener("pagehide", clear); window.removeEventListener("pageshow", restored); };
    // load reads only refs; a new session is created by mounting this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  function submit(event: FormEvent) { event.preventDefault(); if (state === "loading") return; void load(search.trim(), 0, lineup?.version ?? null); }
  const title = enabled ? "Published Event lineup" : "Event sharing is not available yet";
  return <main className="mx-auto min-h-dvh max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
    <header className="mb-8 flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
      <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">Guild Organizer</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Your place in the Party.</p></div>
      <span className="rounded-full border border-[var(--border-subtle)] px-3 py-1 text-xs text-[var(--text-secondary)]">Published • Read only</span>
    </header>
    {!enabled ? <Surface className="mx-auto max-w-xl p-6 sm:p-10"><h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-[var(--text-secondary)]">Your organizer will let you know when member-facing sharing is ready. Shared links stay private.</p></Surface>
      : state !== "ready" || !lineup ? <Surface className="mx-auto max-w-xl p-6 sm:p-10" aria-busy={state === "loading"}>
        <div role="status" aria-live="polite"><h1 className="text-2xl font-semibold">{messages[state === "ready" ? "connection" : state].title}</h1>
          <p className="mt-3 leading-relaxed text-[var(--text-secondary)]">{messages[state === "ready" ? "connection" : state].detail}</p></div>
        {["connection", "limited", "updated"].includes(state) && <Button size="lg" style={{ color: "#07101f" }} className="mt-6" onClick={() => void load(activeSearch, 0, null)}>
          {state === "updated" ? "Load current lineup" : "Try again"}</Button>}
      </Surface> : <>
        <section aria-labelledby="event-heading" className="mb-6">
          <p className="mb-2 text-sm font-medium text-[var(--accent)]">{lineup.eventType}</p>
          <h1 id="event-heading" className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">{lineup.eventName}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
            <span className="rounded-md bg-[var(--accent-soft)] px-2 py-1 text-[var(--accent)]">Version {lineup.version}</span>
            <span>Published <time dateTime={lineup.publishedAt}>{new Date(lineup.publishedAt).toLocaleString()}</time></span>
            <Button variant="ghost" size="lg" onClick={() => void load(activeSearch, 0, lineup.version)}>Check for updates</Button>
          </div>
        </section>
        <Surface className="mb-6 p-4 sm:p-5"><form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1"><label htmlFor="lineup-search" className="mb-2 block text-sm font-semibold">Find your IGN</label>
            <input id="lineup-search" type="search" value={search} onChange={e => setSearch(e.target.value)} maxLength={80}
              autoComplete="off" spellCheck={false} placeholder="Enter your published Character name"
              className="min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-2)] px-3 text-base" /></div>
          <Button type="submit" size="lg" style={{ color: "#07101f" }}>Find assignment</Button>
          {activeSearch && <Button variant="secondary" size="lg" onClick={() => { setSearch(""); void load("", 0, lineup.version); }}>Show all</Button>}
        </form><p className="mt-3 text-sm text-[var(--text-secondary)]">Search uses the published lineup. Similar or duplicate names show every matching Party.</p></Surface>
        <p ref={results} tabIndex={-1} role="status" className="mb-4 text-sm text-[var(--text-secondary)]">{activeSearch
          ? `${lineup.matchedCards} matching ${lineup.matchedCards === 1 ? "Party" : "Parties"} for “${activeSearch}”`
          : `${lineup.totalCards} lineup ${lineup.totalCards === 1 ? "card" : "cards"}`}</p>
        {lineup.cards.length === 0 && <Surface className="p-6"><h2 className="text-lg font-semibold">{activeSearch ? "No published assignment found" : "The published lineup is empty"}</h2>
          <p className="mt-2 text-[var(--text-secondary)]">{activeSearch ? "Check your spelling or ask your organizer whether your Character was included in this version." : "Your organizer can publish an updated lineup when assignments are ready."}</p></Surface>}
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lineup.cards.map(card => <Surface key={card.ordinal} className="overflow-hidden">
            <div className="border-b border-[var(--border-subtle)] p-4"><p className="break-words text-xs text-[var(--text-secondary)]">{[card.area, card.team].filter(Boolean).join(" / ") || "Lineup"}</p>
              <h2 className="mt-1 break-words text-lg font-semibold">{card.party ?? card.team ?? card.area ?? "Lineup"}</h2></div>
            {card.slots.length ? <ul className="divide-y divide-[var(--border-subtle)]">{card.slots.map((slot, index) => {
              const match = Boolean(activeSearch && slot.ign?.toLocaleLowerCase().includes(activeSearch.toLocaleLowerCase()));
              return <li key={index} className={`p-4 ${match ? "bg-[var(--accent-soft)]" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]"><span>{slot.name}</span><span>{slot.roleLabel}</span></div>
                <p className="mt-2 break-words font-semibold">{slot.ign ?? "Unassigned"}{match && <span className="ml-2 text-xs text-[var(--accent)]">Matching assignment</span>}</p>
                {(slot.className || slot.characterRole) && <p className="mt-1 break-words text-sm text-[var(--text-secondary)]">{[slot.className, slot.characterRole].filter(Boolean).join(" · ")}</p>}
              </li>;
            })}</ul> : <p className="p-4 text-sm text-[var(--text-secondary)]">No published slots in this {card.party ? "Party" : "group"}.</p>}
          </Surface>)}
        </div>
        {lineup.matchedCards > 12 && <nav aria-label="Lineup pages" className="mt-6 flex items-center justify-between gap-3">
          <Button size="lg" variant="secondary" disabled={page === 0} onClick={() => void load(activeSearch, page - 1, lineup.version)}>Previous</Button>
          <span className="text-sm">Page {page + 1} of {Math.ceil(lineup.matchedCards / 12)}</span>
          <Button size="lg" variant="secondary" disabled={(page + 1) * 12 >= lineup.matchedCards} onClick={() => void load(activeSearch, page + 1, lineup.version)}>Next</Button>
        </nav>}
      </>}
    <footer className="mt-10 border-t border-[var(--border-subtle)] pt-5 text-xs leading-relaxed text-[var(--text-secondary)]">Only published assignments appear here. Keep your shared link within your Guild.</footer>
  </main>;
}
