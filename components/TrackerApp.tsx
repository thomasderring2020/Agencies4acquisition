"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Agency, AgencyListPayload, Overrides, Status, SyncMeta } from "@/lib/types";
import { effectiveStatus, STATUSES } from "@/lib/types";
import { relTime } from "@/lib/format";
import Sidebar, { type Filters, EMPTY_FILTERS } from "./Sidebar";
import ListView from "./ListView";
import DetailPanel from "./DetailPanel";
import { IconMenu, IconSearch, IconSync, IconUpload } from "./Icons";
import Greeting from "./Greeting";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <div className="card mapcard" /> });

export type View = "list" | "map";

export interface Toast {
  text: string;
  bad?: boolean;
}

const USER_KEY = "mna_user";
const VIEW_KEY = "mna_view";

export function getUser(): string {
  try {
    return localStorage.getItem(USER_KEY) || "";
  } catch {
    return "";
  }
}

export default function TrackerApp() {
  const [data, setData] = useState<AgencyListPayload | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [view, setView] = useState<View>("list");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<string | null>(null);
  const [user, setUser] = useState("");
  const [askName, setAskName] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const autoSynced = useRef(false);

  const flash = useCallback((t: Toast) => {
    setToast(t);
    window.setTimeout(() => setToast((cur) => (cur === t ? null : cur)), t.bad ? 7000 : 4000);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/agencies", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setData(await res.json());
      setLoadErr("");
    } catch (e) {
      setLoadErr((e as Error).message);
    }
  }, []);

  // Initial load, name, saved view, deep link (#agency-id)
  useEffect(() => {
    load();
    const u = getUser();
    setUser(u);
    if (!u) setAskName(true);
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "map" || v === "list") setView(v);
    } catch {}
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (hash) setSelected(hash);
  }, [load]);

  // Pick up teammates' changes: refresh on focus and every 2 minutes while visible.
  useEffect(() => {
    const onFocus = () => document.visibilityState === "visible" && load();
    const t = window.setInterval(onFocus, 120_000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [load]);

  useEffect(() => {
    document.body.classList.toggle("drawer-open", filtersOpen);
  }, [filtersOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {}
  }, [view]);

  useEffect(() => {
    // Keep the open agency in the URL so a link can be shared with a teammate.
    if (selected) history.replaceState(null, "", `#${encodeURIComponent(selected)}`);
    else if (window.location.hash) history.replaceState(null, "", window.location.pathname);
  }, [selected]);

  const runSync = useCallback(
    async (csv?: string) => {
      setSyncing(true);
      try {
        const res = await fetch("/api/sync", {
          method: "POST",
          headers: csv ? { "content-type": "text/csv" } : {},
          body: csv ?? "",
        });
        const j = (await res.json()) as SyncMeta & { error?: string };
        if (!res.ok) throw new Error(j.error || "Sync failed");
        const parts = [`${j.total} agencies`, `${j.added} new`];
        if (j.removed) parts.push(`${j.removed} no longer in sheet`);
        if (j.unmapped.length) parts.push(`${j.unmapped.length} mapped to state only`);
        flash({ text: `Synced · ${parts.join(" · ")}` });
        await load();
      } catch (e) {
        flash({ text: (e as Error).message, bad: true });
      } finally {
        setSyncing(false);
      }
    },
    [flash, load]
  );

  // First run: database empty but a sheet link is configured → pull it once automatically.
  useEffect(() => {
    if (data && !data.agencies.length && data.sheetConfigured && !autoSynced.current) {
      autoSynced.current = true;
      runSync();
    }
  }, [data, runSync]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    runSync(await f.text());
  };

  const setStatus = useCallback(
    async (id: string, status: Status) => {
      if (!data) return;
      const prev = data.statuses[id];
      const rec = { status, by: user || "Someone", at: new Date().toISOString() };
      setData((d) => (d ? { ...d, statuses: { ...d.statuses, [id]: rec } } : d));
      const res = await fetch(`/api/agencies/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, by: user }),
      });
      if (!res.ok) {
        setData((d) => {
          if (!d) return d;
          const statuses = { ...d.statuses };
          if (prev) statuses[id] = prev;
          else delete statuses[id];
          return { ...d, statuses };
        });
        flash({ text: "Couldn't save status. Check your connection and try again.", bad: true });
      }
    },
    [data, user, flash]
  );

  const setOverride = useCallback(
    async (id: string, patch: Overrides) => {
      const res = await fetch(`/api/agencies/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...patch, by: user }),
      });
      if (!res.ok) return flash({ text: "Couldn't save link.", bad: true });
      const j = await res.json();
      setData((d) => (d ? { ...d, overrides: { ...d.overrides, [id]: { ...d.overrides[id], ...j.overrides } } } : d));
    },
    [user, flash]
  );

  const setCounts = useCallback((id: string, c: { contacts: number; notes: number }) => {
    setData((d) => (d ? { ...d, counts: { ...d.counts, [id]: c } } : d));
  }, []);

  // ---- Derived ----
  const agencies = data?.agencies ?? [];
  const statuses = data?.statuses ?? {};
  const excluded = useMemo(() => new Set(data?.meta.excludedStates ?? []), [data]);
  const latestWeek = useMemo(() => agencies.reduce((m, a) => (a.weekAdded > m ? a.weekAdded : m), ""), [agencies]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return agencies.filter((a) => {
      const st = effectiveStatus(a, statuses);
      if (filters.statuses.length && !filters.statuses.includes(st)) return false;
      if (filters.priorities.length && !filters.priorities.includes(a.priority || "—")) return false;
      if (filters.calls.length && !filters.calls.includes(a.sheetStatus || "—")) return false;
      if (filters.tiers.length && !filters.tiers.includes(a.tier || "—")) return false;
      if (filters.hideExcluded && excluded.has(a.state)) return false;
      if (filters.newOnly && a.weekAdded !== latestWeek) return false;
      if (!filters.showRemoved && !a.inSheet) return false;
      if (q) {
        const hay = `${a.name} ${a.hq} ${a.targetMarket} ${a.specialty} ${a.state}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [agencies, statuses, filters, excluded, latestWeek]);

  const selectedAgency: Agency | null = useMemo(() => agencies.find((a) => a.id === selected) ?? null, [agencies, selected]);
  const meta = data?.meta;

  return (
    <div className="shell">
      <header className="topbar">
        <button className="iconbtn filters-toggle" aria-label="Open menu" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((o) => !o)}>
          <IconMenu />
        </button>
        <div className="crumbs">
          <span className="hide-sm">M&amp;A Watch</span>
          <span className="sep hide-sm">/</span>
          <span className="hide-sm">Targets</span>
          <span className="sep hide-sm">/</span>
          <b>{view === "list" ? "List" : "Map"}</b>
        </div>
        <div className="spacer" />
        {meta?.syncedAt && (
          <div className="syncinfo" title={meta.sheetNote}>
            SYNCED <b>{relTime(meta.syncedAt)}</b>
            {meta.sheetNote && /updated\s+(\d{4}-\d{2}-\d{2})/i.test(meta.sheetNote) && (
              <> · SHEET <b>{/updated\s+(\d{4}-\d{2}-\d{2})/i.exec(meta.sheetNote)![1]}</b></>
            )}
          </div>
        )}
        <label className="search">
          <IconSearch />
          <input
            placeholder="Search agencies…"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            aria-label="Search agencies"
          />
        </label>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onUpload} />
        <button className="btn ghost" onClick={() => fileRef.current?.click()} disabled={syncing} title="Upload a CSV export of the sheet">
          <IconUpload /> <span className="hide-sm">CSV</span>
        </button>
        <button
          className="btn accent"
          onClick={() => runSync()}
          disabled={syncing || !data?.sheetConfigured}
          title={data?.sheetConfigured ? "Pull the latest from the Google Sheet" : "Set SHEET_CSV_URL in Vercel to enable"}
        >
          {syncing ? <span className="spin" /> : <IconSync />} Sync now
        </button>
        <button className="btn ghost" onClick={() => setAskName(true)} title="Change your name">
          {user ? user.split(" ")[0] : "Name"}
        </button>
      </header>

      <div className="body">
        {filtersOpen && <div className="drawer-back" onClick={() => setFiltersOpen(false)} aria-hidden />}
        <Sidebar
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          view={view}
          setView={(v) => {
            setView(v);
            setFiltersOpen(false);
          }}
          filters={filters}
          setFilters={setFilters}
          agencies={agencies.filter((a) => a.inSheet || filters.showRemoved)}
          statuses={statuses}
          excluded={excluded}
          latestWeek={latestWeek}
          meta={meta}
        />

        <main className="main">
          {data?.storage === "local" && process.env.NODE_ENV === "production" && (
            <div className="banner">Database not connected — changes won&apos;t be saved. Add Upstash Redis in Vercel (see README).</div>
          )}
          {loadErr && <div className="banner">Couldn&apos;t load: {loadErr}</div>}
          {!data ? (
            <div className="card emptystate"><span className="spin" /></div>
          ) : !agencies.length ? (
            <div className="card emptystate plus">
              <div>
                <h2>No agencies yet</h2>
                <p>
                  {data.sheetConfigured
                    ? "Pull the latest from the Google Sheet, or upload a CSV export."
                    : "Upload a CSV export of the target sheet to get started. To sync automatically, set SHEET_CSV_URL in Vercel."}
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                  <button className="btn" onClick={() => fileRef.current?.click()} disabled={syncing}><IconUpload /> Upload CSV</button>
                  {data.sheetConfigured && <button className="btn accent" onClick={() => runSync()} disabled={syncing}><IconSync /> Sync now</button>}
                </div>
              </div>
            </div>
          ) : view === "list" ? (
            <>
            <Greeting
              user={user}
              agencies={agencies}
              statuses={statuses}
              latestWeek={latestWeek}
              meta={meta}
              newOnly={filters.newOnly}
              onToggleNew={() => setFilters((f) => ({ ...f, newOnly: !f.newOnly }))}
            />
            <ListView
              rows={filtered}
              all={agencies}
              statuses={statuses}
              counts={data.counts}
              excluded={excluded}
              latestWeek={latestWeek}
              selected={selected}
              onOpen={setSelected}
              onStatus={setStatus}
            />
            </>
          ) : (
            <MapView rows={filtered} statuses={statuses} excluded={excluded} selected={selected} onOpen={setSelected} />
          )}
        </main>
      </div>

      {selectedAgency && (
        <DetailPanel
          key={selectedAgency.id}
          agency={selectedAgency}
          status={effectiveStatus(selectedAgency, statuses)}
          statusRec={statuses[selectedAgency.id]}
          overrides={data?.overrides[selectedAgency.id] ?? {}}
          excluded={excluded.has(selectedAgency.state)}
          isNew={selectedAgency.weekAdded === latestWeek}
          user={user}
          onClose={() => setSelected(null)}
          onStatus={(s) => setStatus(selectedAgency.id, s)}
          onOverride={(p) => setOverride(selectedAgency.id, p)}
          onCounts={(c) => setCounts(selectedAgency.id, c)}
          flash={flash}
        />
      )}

      {askName && (
        <NameModal
          initial={user}
          onSave={(n) => {
            try {
              localStorage.setItem(USER_KEY, n);
            } catch {}
            setUser(n);
            setAskName(false);
          }}
          onCancel={user ? () => setAskName(false) : undefined}
        />
      )}

      {toast && <div className={`toast${toast.bad ? " bad" : ""}`} role="status">{toast.text}</div>}
    </div>
  );
}

function NameModal({ initial, onSave, onCancel }: { initial: string; onSave: (n: string) => void; onCancel?: () => void }) {
  const [v, setV] = useState(initial);
  return (
    <div className="modal-back">
      <form
        className="modal plus"
        onSubmit={(e) => {
          e.preventDefault();
          if (v.trim()) onSave(v.trim());
        }}
      >
        <div className="label">Welcome</div>
        <h2 style={{ marginTop: 6 }}>What&apos;s your name?</h2>
        <p>It&apos;s shown on the contacts, notes and status changes you make, so the team knows who did what.</p>
        <div className="input">
          <input autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder="First and last name" aria-label="Your name" />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          {onCancel && <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>}
          <button className="btn accent" disabled={!v.trim()}>Continue</button>
        </div>
      </form>
    </div>
  );
}

export { STATUSES };
