"use client";
import { useEffect, useState } from "react";
import type { Agency, StatusRecord, SyncMeta } from "@/lib/types";
import { effectiveStatus } from "@/lib/types";
import { relTime } from "@/lib/format";

function partOfDay(h: number) {
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Working late";
}

export default function Greeting(props: {
  user: string;
  agencies: Agency[];
  statuses: Record<string, StatusRecord>;
  latestWeek: string;
  meta?: SyncMeta;
  newOnly: boolean;
  onToggleNew: () => void;
}) {
  // Time is read on the client only, and refreshed each minute so the greeting turns over on its own.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const live = props.agencies.filter((a) => a.inSheet);
  const fresh = live.filter((a) => a.weekAdded === props.latestWeek).length;
  let working = 0, research = 0, untouched = 0;
  for (const a of live) {
    const s = effectiveStatus(a, props.statuses);
    if (s === "Working") working++;
    if (s === "Researching") research++;
    if (s === "New" && !props.statuses[a.id]) untouched++;
  }
  const first = props.user.split(" ")[0];

  const parts: string[] = [];
  if (fresh) parts.push(`${fresh} new target${fresh === 1 ? "" : "s"} landed this week`);
  if (working || research) parts.push(`${working} being worked, ${research} in research`);
  if (untouched) parts.push(`${untouched} still unreviewed`);

  return (
    <section className="card greeting" aria-label="Greeting">
      <div className="greeting-art" aria-hidden />
      <div className="greeting-body">
        <div className="label">
          {now ? now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : " "}
          {props.meta?.syncedAt ? <span className="greeting-sync"> · Synced {relTime(props.meta.syncedAt)}</span> : null}
        </div>
        <h1>
          {now ? partOfDay(now.getHours()) : "Hello"}
          {first ? `, ${first}` : ""}
          <span className="accent">.</span>
        </h1>
        <p>{parts.length ? parts.join(" · ") + "." : "Everything is reviewed. Nice work."}</p>
      </div>
      {fresh > 0 && (
        <button className={`btn${props.newOnly ? " accent" : ""} greeting-cta`} onClick={props.onToggleNew}>
          {props.newOnly ? "Show all targets" : `Review ${fresh} new →`}
        </button>
      )}
    </section>
  );
}
