"use client";
import { useMemo, useState } from "react";
import type { Agency, Status, StatusRecord } from "@/lib/types";
import { effectiveStatus, STATUSES } from "@/lib/types";
import { midpoint, money, pad2, shortDate } from "@/lib/format";
import StatusPill from "./StatusPill";

type SortKey = "rank" | "name" | "priority" | "revenue" | "feasibility" | "tier" | "added" | "status";

export function feasibilityScore(f: string): number {
  const v = f.toLowerCase();
  if (!v) return -1;
  if (v.includes("exclu")) return 0;
  if (v === "high") return 5;
  if (v.includes("high")) return 4; // High-Medium / Medium-High
  if (v === "medium") return 3;
  if (v.includes("medium")) return 2; // Medium-Low / Low-Medium
  if (v === "low") return 1;
  return -1;
}

export function Meter({ value }: { value: string }) {
  const s = feasibilityScore(value);
  return (
    <span className="meter" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={i <= s ? "on" : ""} />
      ))}
    </span>
  );
}

const tierScore = (t: string) => {
  const m = /^tier (\d)/i.exec(t);
  return m ? Number(m[1]) : /exclu/i.test(t) ? 9 : 5;
};

export default function ListView(props: {
  rows: Agency[];
  all: Agency[];
  statuses: Record<string, StatusRecord>;
  counts: Record<string, { contacts: number; notes: number }>;
  excluded: Set<string>;
  latestWeek: string;
  selected: string | null;
  onOpen: (id: string) => void;
  onStatus: (id: string, s: Status) => void;
}) {
  const { rows, statuses, counts, excluded, latestWeek } = props;
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "rank", dir: 1 });

  const sorted = useMemo(() => {
    const val = (a: Agency): number | string => {
      switch (sort.key) {
        case "rank": return a.rank ?? 9999;
        case "name": return a.name.toLowerCase();
        case "priority": return a.priority || "Z";
        case "revenue": return midpoint(a) ?? -1;
        case "feasibility": return feasibilityScore(a.feasibility);
        case "tier": return tierScore(a.tier);
        case "added": return a.weekAdded;
        case "status": return STATUSES.indexOf(effectiveStatus(a, statuses));
      }
    };
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b);
      const c = x < y ? -1 : x > y ? 1 : 0;
      return c * sort.dir || (a.rank ?? 9999) - (b.rank ?? 9999);
    });
  }, [rows, sort, statuses]);

  const kpi = useMemo(() => {
    let inPlay = 0, passed = 0, fresh = 0, rev = 0;
    for (const a of rows) {
      const s = effectiveStatus(a, statuses);
      if (s === "Researching" || s === "Working") inPlay++;
      if (s === "Passed to M&A") passed++;
      if (a.weekAdded === latestWeek) fresh++;
      rev += midpoint(a) ?? 0;
    }
    return { inPlay, passed, fresh, rev };
  }, [rows, statuses, latestWeek]);

  const th = (key: SortKey, label: string, cls = "") => (
    <th className={`${cls}${sort.key === key ? " sorted" : ""}`} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "revenue" || key === "feasibility" || key === "added" ? -1 : 1 }))}>
        {label} {sort.key === key ? (sort.dir === 1 ? "↑" : "↓") : ""}
      </button>
    </th>
  );

  return (
    <>
      <div className="card kpis plus">
        <div className="kpi"><div className="v">{pad2(rows.length)}<sup>AGY</sup></div><div className="k label">Targets</div></div>
        <div className={`kpi${kpi.fresh ? " hot" : ""}`}><div className="v">{pad2(kpi.fresh)}<sup>WK</sup></div><div className="k label">New this week</div></div>
        <div className="kpi"><div className="v">{pad2(kpi.inPlay)}<sup>ACT</sup></div><div className="k label">In play</div></div>
        <div className="kpi"><div className="v">{pad2(kpi.passed)}<sup>M&amp;A</sup></div><div className="k label">Passed to M&amp;A</div></div>
        <div className="kpi"><div className="v">{Math.round(kpi.rev).toLocaleString()}<sup>$M</sup></div><div className="k label">Combined revenue</div></div>
      </div>

      <div className="card tablecard">
        <div className="tablehead">
          <div className="label">Target list · {rows.length} of {props.all.filter((a) => a.inSheet).length}</div>
          <div className="label" style={{ color: "var(--ink-4)" }}>Click a row for full profile</div>
        </div>
        <div className="tablewrap">
          {!rows.length ? (
            <div className="emptystate"><div><h2>No matches</h2><p>Try clearing a filter or the search box.</p></div></div>
          ) : (
            <table className="targets">
              <thead>
                <tr>
                  {th("rank", "#")}
                  {th("name", "Agency")}
                  {th("priority", "Pri")}
                  {th("revenue", "Revenue")}
                  <th className="col-specialty">Specialty</th>
                  {th("feasibility", "Feasibility")}
                  {th("tier", "Market tier")}
                  <th>Call</th>
                  {th("added", "Added")}
                  {th("status", "Status", "statuscol")}
                </tr>
              </thead>
              <tbody>
                {sorted.map((a) => {
                  const st = effectiveStatus(a, statuses);
                  const c = counts[a.id];
                  const excl = excluded.has(a.state);
                  return (
                    <tr
                      key={a.id}
                      className={`${props.selected === a.id ? "sel" : ""}${st === "Lost" || !a.inSheet ? " dim" : ""}`}
                      onClick={() => props.onOpen(a.id)}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && props.onOpen(a.id)}
                    >
                      <td className="rank">{pad2(a.rank)}</td>
                      <td>
                        <div className="agency-name">
                          {a.name}
                          {a.weekAdded === latestWeek && <span className="tag accent">New</span>}
                          {excl && <span className="tag warn" title="HQ in an excluded state">Excl. geo</span>}
                          {!a.inSheet && <span className="tag">Dropped</span>}
                          {c && (c.contacts > 0 || c.notes > 0) && (
                            <span className="tag" title={`${c.contacts} contacts · ${c.notes} notes`}>
                              {c.contacts ? `${c.contacts} ctc` : ""}{c.contacts && c.notes ? " · " : ""}{c.notes ? `${c.notes} note${c.notes > 1 ? "s" : ""}` : ""}
                            </span>
                          )}
                        </div>
                        <div className="agency-sub" title={a.hq}>
                          {a.city && a.state ? `${a.city}, ${a.state}` : a.hq}
                          {a.targetMarket ? ` · ${a.targetMarket}` : ""}
                        </div>
                      </td>
                      <td><span className={`pri ${a.priority}`}>{a.priority || "—"}</span></td>
                      <td className="num">{money(a.revenueLow, a.revenueHigh)}</td>
                      <td className="col-specialty"><div className="clip" title={a.specialty}>{a.specialty}</div></td>
                      <td><span className="feas"><Meter value={a.feasibility} />{a.feasibility || "—"}</span></td>
                      <td><span className="mono" style={{ fontSize: 11.5, textTransform: "uppercase", whiteSpace: "nowrap" }} title={a.tier}>{shortTier(a.tier)}</span></td>
                      <td>{a.sheetStatus && !/^new$/i.test(a.sheetStatus) ? <span className={`tag${/pass/i.test(a.sheetStatus) ? " dark" : ""}`}>{a.sheetStatus}</span> : <span className="muted">—</span>}</td>
                      <td className="num" style={{ color: "var(--ink-3)" }}>{a.weekAdded ? shortDate(a.weekAdded) : "—"}</td>
                      <td className="statuscell statuscol"><StatusPill value={st} onChange={(s) => props.onStatus(a.id, s)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

function shortTier(t: string) {
  if (!t) return "—";
  if (/^outside/i.test(t)) return "Outside tiers";
  if (/^excluded/i.test(t)) return "Excluded";
  if (/^eligible hq/i.test(t)) return "Eligible HQ*";
  if (/deprioritized/i.test(t)) return "Deprioritized";
  return t;
}
