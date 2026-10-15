"use client";
import { useMemo } from "react";
import type { Agency, StatusRecord, SyncMeta } from "@/lib/types";
import { effectiveStatus, STATUSES } from "@/lib/types";
import { StatusDot } from "./StatusPill";
import type { View } from "./TrackerApp";
import { IconClose, IconList, IconMap, IconSearch } from "./Icons";

export interface Filters {
  q: string;
  statuses: string[];
  priorities: string[];
  calls: string[];
  tiers: string[];
  hideExcluded: boolean;
  newOnly: boolean;
  showRemoved: boolean;
}

export const EMPTY_FILTERS: Filters = {
  q: "",
  statuses: [],
  priorities: [],
  calls: [],
  tiers: [],
  hideExcluded: false,
  newOnly: false,
  showRemoved: false,
};

function countBy<T extends string>(items: Agency[], key: (a: Agency) => T) {
  const m = new Map<T, number>();
  for (const a of items) m.set(key(a), (m.get(key(a)) ?? 0) + 1);
  return m;
}

const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export default function Sidebar(props: {
  open: boolean;
  onClose: () => void;
  view: View;
  setView: (v: View) => void;
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  agencies: Agency[];
  statuses: Record<string, StatusRecord>;
  excluded: Set<string>;
  latestWeek: string;
  meta?: SyncMeta;
}) {
  const { view, setView, filters: f, setFilters, agencies, statuses, excluded, latestWeek } = props;
  const statusCounts = useMemo(() => countBy(agencies, (a) => effectiveStatus(a, statuses)), [agencies, statuses]);
  const priCounts = useMemo(() => countBy(agencies, (a) => a.priority || "—"), [agencies]);
  const callCounts = useMemo(() => countBy(agencies, (a) => a.sheetStatus || "—"), [agencies]);
  const tierCounts = useMemo(() => countBy(agencies, (a) => a.tier || "—"), [agencies]);
  const newCount = agencies.filter((a) => a.weekAdded === latestWeek).length;
  const exclCount = agencies.filter((a) => excluded.has(a.state)).length;
  const active =
    f.statuses.length + f.priorities.length + f.calls.length + f.tiers.length + (f.hideExcluded ? 1 : 0) + (f.newOnly ? 1 : 0);

  const tiers = [...tierCounts.entries()].sort((a, b) => tierRank(a[0]) - tierRank(b[0]) || b[1] - a[1]);
  const calls = [...callCounts.entries()].sort((a, b) => callRank(a[0]) - callRank(b[0]));

  return (
    <aside className={`sidebar${props.open ? " open" : ""}`} aria-label="Views and filters">
      <section>
        <div className="side-title">
          [TARGETS] <span className="flag" />
          <button className="iconbtn drawer-close" onClick={props.onClose} aria-label="Close menu"><IconClose /></button>
        </div>
        <label className="search side-search">
          <IconSearch />
          <input
            placeholder="Search agencies…"
            value={f.q}
            onChange={(e) => setFilters((x) => ({ ...x, q: e.target.value }))}
            aria-label="Search agencies"
          />
        </label>
        <nav className="nav">
          <button className={view === "list" ? "on" : ""} onClick={() => setView("list")}>
            <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><IconList size={13} /> List</span>
            <span className="count">{agencies.length}</span>
          </button>
          <button className={view === "map" ? "on" : ""} onClick={() => setView("map")}>
            <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><IconMap size={13} /> Map</span>
            <span className="count">{agencies.filter((a) => a.lat != null).length}</span>
          </button>
        </nav>
      </section>
      <div className="hatch" />

      <section>
        <div className="group-label label">
          Status
          {active > 0 && <button onClick={() => setFilters((x) => ({ ...EMPTY_FILTERS, q: x.q, showRemoved: x.showRemoved }))}>Clear all</button>}
        </div>
        {STATUSES.map((s) => (
          <label className="check" key={s}>
            <input type="checkbox" checked={f.statuses.includes(s)} onChange={() => setFilters((x) => ({ ...x, statuses: toggle(x.statuses, s) }))} />
            <span className="box" />
            <StatusDot status={s} />
            <span className="grow">{s}</span>
            <span className="n">{statusCounts.get(s) ?? 0}</span>
          </label>
        ))}
      </section>
      <div className="hatch" />

      <section>
        <div className="group-label label">Diligence priority</div>
        <div className="chips">
          {[...priCounts.keys()].sort().map((p) => (
            <button
              key={p}
              className={`chip${f.priorities.includes(p) ? " on" : ""}`}
              aria-pressed={f.priorities.includes(p)}
              onClick={() => setFilters((x) => ({ ...x, priorities: toggle(x.priorities, p) }))}
              title={`${priCounts.get(p)} agencies`}
            >
              {p} <span style={{ opacity: 0.55, marginLeft: 4 }}>{priCounts.get(p)}</span>
            </button>
          ))}
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="group-label label">Research call</div>
        {calls.map(([c, n]) => (
          <label className="check" key={c}>
            <input type="checkbox" checked={f.calls.includes(c)} onChange={() => setFilters((x) => ({ ...x, calls: toggle(x.calls, c) }))} />
            <span className="box" />
            <span className="grow">{c}</span>
            <span className="n">{n}</span>
          </label>
        ))}
      </section>
      <div className="hatch" />

      <section>
        <div className="group-label label">Market tier</div>
        {tiers.map(([t, n]) => (
          <label className="check" key={t} title={t}>
            <input type="checkbox" checked={f.tiers.includes(t)} onChange={() => setFilters((x) => ({ ...x, tiers: toggle(x.tiers, t) }))} />
            <span className="box" />
            <span className="grow">{t}</span>
            <span className="n">{n}</span>
          </label>
        ))}
      </section>
      <div className="hatch" />

      <section>
        <div className="group-label label">Layers</div>
        <label className="check">
          <input type="checkbox" checked={f.newOnly} onChange={() => setFilters((x) => ({ ...x, newOnly: !x.newOnly }))} />
          <span className="box" />
          <span className="grow">New this week</span>
          <span className="n">{newCount}</span>
        </label>
        {excluded.size > 0 && (
          <label className="check" title={`Excluded states: ${[...excluded].join(", ")}`}>
            <input type="checkbox" checked={f.hideExcluded} onChange={() => setFilters((x) => ({ ...x, hideExcluded: !x.hideExcluded }))} />
            <span className="box" />
            <span className="grow">Hide excluded geo</span>
            <span className="n">{exclCount}</span>
          </label>
        )}
        <label className="check">
          <input type="checkbox" checked={f.showRemoved} onChange={() => setFilters((x) => ({ ...x, showRemoved: !x.showRemoved }))} />
          <span className="box" />
          <span className="grow">Show dropped from sheet</span>
        </label>
      </section>

      {props.meta?.screenNote && (
        <>
          <div className="hatch" />
          <section>
            <div className="group-label label">Screen</div>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: "var(--ink-2)" }}>{props.meta.screenNote.replace(/^screen:\s*/i, "")}</p>
          </section>
        </>
      )}
    </aside>
  );
}

function tierRank(t: string) {
  const m = /^tier (\d)/i.exec(t);
  if (m) return Number(m[1]);
  if (/exclu/i.test(t)) return 9;
  return 5;
}
function callRank(c: string) {
  return ["new", "watch", "pass"].indexOf(c.toLowerCase()) + 1 || 9;
}
