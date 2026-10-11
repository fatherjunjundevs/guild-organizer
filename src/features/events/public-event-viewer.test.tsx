import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { PublicEventViewer } from "./public-event-viewer";

const token=`v1.${"A".repeat(43)}`;
const ready = { status:"ready",eventName:"Friday League",eventType:"Raid",version:3,publishedAt:"2026-10-11T12:00:00Z",page:0,pageSize:12,totalCards:2,matchedCards:2,
  cards:[{ordinal:1,area:"North",team:"Team One",party:"Party One",slots:[{name:"Seat 1",roleLabel:"Support",ign:"Hero",className:"Bishop",characterRole:"Healer"}]},
    {ordinal:2,area:"South",team:"Team Two",party:"Party Two",slots:[{name:"Seat 1",roleLabel:null,ign:"Hero",className:"Knight",characterRole:null}]}] };
beforeEach(()=>{window.history.replaceState(null,"","/share/event");vi.stubGlobal("fetch",vi.fn().mockImplementation(async () => Response.json(ready)));});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});

function deferredAbortAwareFetch() {
  const requests: { signal: AbortSignal; finish: (response: Response) => void }[] = [];
  vi.mocked(fetch).mockImplementation((_url, options) => new Promise<Response>((resolve, reject) => {
    const signal = options?.signal;
    if (!signal) throw new Error("Expected abort signal");
    const abort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    requests.push({ signal, finish: response => {
      signal.removeEventListener("abort", abort);
      if (signal.aborted) abort(); else resolve(response);
    } });
    if (signal.aborted) abort();
  }));
  return requests;
}

describe("Strict Mode fragment lifecycle", () => {
  it("loads the current lineup after a real effect setup/cleanup replay", async () => {
    const requests = deferredAbortAwareFetch();
    const removeListener = vi.spyOn(window, "removeEventListener");
    window.history.replaceState(null, "", `/share/event?ignored=1#token=${token}`);
    render(<StrictMode><PublicEventViewer enabled /></StrictMode>);
    expect(window.location.hash).toBe(""); expect(window.location.search).toBe("");
    // Prove React replayed cleanup before the deferred initial request starts.
    expect(removeListener.mock.calls.filter(([type]) => type === "hashchange")).toHaveLength(1);
    expect(requests).toHaveLength(0);
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].signal.aborted).toBe(false);
    await act(async () => { requests[0].finish(Response.json(ready)); });
    await screen.findByRole("heading", { name: "Friday League" });
    expect(screen.getByText("Version 3")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(document.documentElement.outerHTML).not.toContain(token);
    expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
  });

  it.each(["pagehide", "pageshow"])("discards a pending request on %s without restoring its bearer", async type => {
    const requests = deferredAbortAwareFetch();
    window.history.replaceState(null, "", `/share/event#token=${token}`);
    render(<StrictMode><PublicEventViewer enabled /></StrictMode>);
    await waitFor(() => expect(requests).toHaveLength(1));
    const event = new Event(type);
    if (type === "pageshow") Object.defineProperty(event, "persisted", { value: true });
    fireEvent(window, event);
    expect(requests[0].signal.aborted).toBe(true);
    await act(async () => { requests[0].finish(Response.json(ready)); });
    await screen.findByRole("heading", { name: "Your lineup starts with a shared link" });
    expect(screen.queryByText("Hero")).not.toBeInTheDocument();
    fireEvent(window, new Event("pageshow")); fireEvent(window, new Event("hashchange"));
    await act(async () => { await Promise.resolve(); });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe("");
    expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
  });

  it("aborts a superseded fragment request and only displays the new lineup", async () => {
    const requests = deferredAbortAwareFetch();
    window.history.replaceState(null, "", `/share/event#token=${token}`);
    render(<StrictMode><PublicEventViewer enabled /></StrictMode>);
    await waitFor(() => expect(requests).toHaveLength(1));
    const nextToken = `v1.${"B".repeat(42)}A`;
    window.history.replaceState(null, "", `/share/event#token=${nextToken}`);
    fireEvent(window, new Event("hashchange"));
    expect(window.location.hash).toBe(""); expect(requests[0].signal.aborted).toBe(true);
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1].signal.aborted).toBe(false);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body)).token).toBe(nextToken);
    await act(async () => { requests[1].finish(Response.json({ ...ready, eventName: "New Event", version: 4 })); });
    await screen.findByRole("heading", { name: "New Event" });
    await act(async () => { requests[0].finish(Response.json(ready)); });
    expect(screen.queryByRole("heading", { name: "Friday League" })).not.toBeInTheDocument();
    expect(screen.getByText("Version 4")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(document.documentElement.outerHTML).not.toContain(nextToken);
  });

  it("starts only one request without development replay", async () => {
    const requests = deferredAbortAwareFetch();
    window.history.replaceState(null, "", `/share/event#token=${token}`);
    render(<PublicEventViewer enabled />);
    await waitFor(() => expect(requests).toHaveLength(1));
    await act(async () => { requests[0].finish(Response.json(ready)); });
    await screen.findByRole("heading", { name: "Friday League" });
    expect(fetch).toHaveBeenCalledTimes(1); expect(requests[0].signal.aborted).toBe(false);
  });
});
describe("fragment-only member viewer",()=>{
  it("shows helpful empty state without networking",()=>{render(<PublicEventViewer enabled />);expect(screen.getByRole("heading",{name:"Your lineup starts with a shared link"})).toBeInTheDocument();expect(fetch).not.toHaveBeenCalled();});
  it("clears sensitive location immediately; sends bearer only in body",async()=>{
    window.history.replaceState(null,"",`/share/event?ignored=1#token=${token}`);render(<PublicEventViewer enabled />);
    expect(window.location.hash).toBe("");expect(window.location.search).toBe("");await screen.findByRole("heading",{name:"Friday League"});
    const [url,options]=vi.mocked(fetch).mock.calls[0];expect(url).toBe("/api/share/event");expect(options?.method).toBe("POST");expect(options?.credentials).toBe("omit");expect(options?.cache).toBe("no-store");expect(options?.referrerPolicy).toBe("no-referrer");
    expect(JSON.parse(String(options?.body)).token).toBe(token);expect(document.documentElement.outerHTML).not.toContain(token);expect(localStorage.length).toBe(0);expect(sessionStorage.length).toBe(0);
  });
  it("shows all duplicate IGN assignments and labeled accessible search",async()=>{
    window.history.replaceState(null,"",`/share/event#token=${token}`);render(<PublicEventViewer enabled />);await screen.findByRole("heading",{name:"Friday League"});
    fireEvent.change(screen.getByRole("searchbox",{name:"Find your IGN"}),{target:{value:"Hero"}});fireEvent.click(screen.getByRole("button",{name:"Find assignment"}));
    await waitFor(()=>expect(screen.getAllByText("Matching assignment")).toHaveLength(2));expect(screen.getByText("Party One")).toBeInTheDocument();expect(screen.getByText("Party Two")).toBeInTheDocument();
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls.at(-1)?.[1]?.body))).toMatchObject({version:3,page:0,search:"Hero"});
  });
  it.each(["#token=malformed",`#token=${token}&other=1`,"#other=private"])("rejects invalid fragment without request",async fragment=>{
    window.history.replaceState(null,"","/share/event"+fragment);render(<PublicEventViewer enabled />);await screen.findByRole("heading",{name:"This link is incomplete"});expect(fetch).not.toHaveBeenCalled();expect(window.location.hash).toBe("");
  });
  it("remains gated and clears fragment while disabled",async()=>{window.history.replaceState(null,"",`/share/event#token=${token}`);render(<PublicEventViewer enabled={false} />);expect(screen.getByRole("heading",{name:"Event sharing is not available yet"})).toBeInTheDocument();expect(window.location.hash).toBe("");expect(fetch).not.toHaveBeenCalled();});
  it.each([[404,"This lineup is unavailable"],[503,"We couldn’t connect"],[429,"Please pause for a moment"]])("provides safe HTTP %s state",async(status,title)=>{
    vi.mocked(fetch).mockResolvedValue(Response.json({}, {status:Number(status)}));window.history.replaceState(null,"",`/share/event#token=${token}`);render(<PublicEventViewer enabled />);await screen.findByRole("heading",{name:String(title)});expect(document.body.textContent).not.toContain(token);
  });
  it("clears old lineup on republish and loads current version explicitly",async()=>{
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(ready)).mockResolvedValueOnce(Response.json({status:"updated",version:4})).mockResolvedValueOnce(Response.json({...ready,version:4}));
    window.history.replaceState(null,"",`/share/event#token=${token}`);render(<PublicEventViewer enabled />);await screen.findByRole("heading",{name:"Friday League"});fireEvent.click(screen.getByRole("button",{name:"Check for updates"}));await screen.findByRole("heading",{name:"A newer lineup is ready"});expect(screen.queryByText("Hero")).not.toBeInTheDocument();fireEvent.click(screen.getByRole("button",{name:"Load current lineup"}));await screen.findByText("Version 4");expect(JSON.parse(String(vi.mocked(fetch).mock.calls.at(-1)?.[1]?.body)).version).toBeNull();
  });
  it("discards lineup and token on pagehide, including back-forward cache",async()=>{
    window.history.replaceState(null,"",`/share/event#token=${token}`);render(<PublicEventViewer enabled />);await screen.findByRole("heading",{name:"Friday League"});fireEvent(window,new Event("pagehide"));await screen.findByRole("heading",{name:"Your lineup starts with a shared link"});expect(screen.queryByText("Hero")).not.toBeInTheDocument();
  });
  it("renders empty structures without organizer controls",async()=>{
    vi.mocked(fetch).mockResolvedValue(Response.json({...ready,totalCards:1,matchedCards:1,cards:[{ordinal:1,area:null,team:"Empty Team",party:null,slots:[]}]}));window.history.replaceState(null,"",`/share/event#token=${token}`);render(<PublicEventViewer enabled />);await screen.findByText("No published slots in this group.");expect(screen.queryByRole("button",{name:/publish|rotate|revoke/i})).not.toBeInTheDocument();
  });
  it("consumes a new fragment while the same viewer is already open",async()=>{
    render(<PublicEventViewer enabled />);window.history.replaceState(null,"",`/share/event#token=${token}`);
    fireEvent(window,new Event("hashchange"));await screen.findByRole("heading",{name:"Friday League"});expect(window.location.hash).toBe("");
  });
  it("rejects private or unknown response fields",async()=>{
    vi.mocked(fetch).mockResolvedValue(Response.json({...ready,officerNotes:"private"}));window.history.replaceState(null,"",`/share/event#token=${token}`);render(<PublicEventViewer enabled />);
    await screen.findByRole("heading",{name:"We couldn’t connect"});expect(document.body.textContent).not.toContain("private");
  });
  it("ignores an older response after another fragment link replaces it",async()=>{
    let finish!: (response:Response)=>void;
    vi.mocked(fetch).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}))
      .mockResolvedValueOnce(Response.json({...ready,eventName:"New Event"}));
    window.history.replaceState(null,"",`/share/event#token=${token}`);render(<PublicEventViewer enabled />);
    await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1));
    window.history.replaceState(null,"",`/share/event#token=v1.${"B".repeat(42)}A`);fireEvent(window,new Event("hashchange"));
    await screen.findByRole("heading",{name:"New Event"});finish(Response.json(ready));
    await waitFor(()=>expect(screen.queryByRole("heading",{name:"Friday League"})).not.toBeInTheDocument());
  });
});
