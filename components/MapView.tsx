"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature, merge, mesh } from "topojson-client";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import "d3-transition";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import statesTopo from "us-atlas/states-albers-10m.json";
import majorCities from "@/data/major-cities.json";
import type { Agency, StatusRecord } from "@/lib/types";
import { effectiveStatus, STATUSES } from "@/lib/types";
import { midpoint, money, pad2, STATUS_COLOR } from "@/lib/format";
import { byAbbr, byFips, REGIONS, type Region } from "@/lib/states";
import { StatusDot } from "./StatusPill";
import { IconMinus, IconPlus } from "./Icons";

// us-atlas "albers" files are pre-projected to a 975×610 canvas with this exact projection.
const W = 975;
const H = 610;
const projection = geoAlbersUsa().scale(1300).translate([487.5, 305]);
const path = geoPath();

type StateProps = { name: string };
const topo = statesTopo as unknown as Topology<{ states: GeometryCollection<StateProps>; nation: GeometryCollection }>;
const STATES_FC = feature(topo, topo.objects.states) as FeatureCollection<Geometry, StateProps>;
const NATION = feature(topo, topo.objects.nation) as FeatureCollection;
const BORDERS = mesh(topo, topo.objects.states, (a, b) => a !== b);
const STATE_PATHS = STATES_FC.features.map((f) => ({
  fips: String(f.id),
  abbr: byFips[String(f.id)]?.abbr ?? "",
  d: path(f) ?? "",
  c: path.centroid(f as Feature),
  f,
}));
const NATION_D = path(NATION) ?? "";
// Lower 48 only: used in regional views so the Alaska/Hawaii insets don't crowd the map.
const INSETS = new Set(["02", "15"]);
const LOWER48_D =
  path(merge(topo, topo.objects.states.geometries.filter((g) => !INSETS.has(String(g.id))) as never)) ?? "";
const BORDERS_D = path(BORDERS) ?? "";

// Reference cities shown once you zoom into a region (tier 1 first, tier 2 when closer).
type City = { n: string; s: string; lat: number; lng: number; t: number };
const CITIES = (majorCities as City[])
  .map((c) => ({ ...c, p: projection([c.lng, c.lat]) }))
  .filter((c): c is City & { p: [number, number] } => !!c.p);

function regionBounds(region: Region): [[number, number], [number, number]] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of STATE_PATHS) {
    const meta = byFips[s.fips];
    if (!meta || meta.region !== region || meta.abbr === "AK" || meta.abbr === "HI") continue;
    const [[a, b], [c, d]] = path.bounds(s.f as Feature);
    x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d);
  }
  return [[x0, y0], [x1, y1]];
}

interface Marker {
  a: Agency;
  x: number;
  y: number;
  ox: number;
  oy: number;
  r: number;
}

export default function MapView(props: {
  rows: Agency[];
  statuses: Record<string, StatusRecord>;
  excluded: Set<string>;
  selected: string | null;
  onOpen: (id: string) => void;
}) {
  const { rows, statuses, excluded } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [t, setT] = useState<ZoomTransform>(zoomIdentity);
  const [size, setSize] = useState({ w: W, h: H });
  const [region, setRegion] = useState<Region | "All" | null>("All");
  const [hover, setHover] = useState<string | null>(null);

  // Track the rendered size so we know exactly which part of the map is visible.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 14])
      .translateExtent([[-200, -150], [W + 200, H + 150]])
      .on("zoom", (e) => {
        setT(e.transform);
        if (e.sourceEvent) setRegion(null); // user panned/zoomed by hand
      });
    zoomRef.current = z;
    select(svg).call(z).on("dblclick.zoom", null);
    return () => {
      select(svg).on(".zoom", null);
    };
  }, []);

  const markers: Marker[] = useMemo(() => {
    const pts: Marker[] = [];
    const maxRev = Math.max(1, ...rows.map((a) => midpoint(a) ?? 0));
    for (const a of rows) {
      if (a.lat == null || a.lng == null) continue;
      const p = projection([a.lng, a.lat]);
      if (!p) continue;
      const rev = midpoint(a) ?? 0;
      pts.push({ a, x: p[0], y: p[1], ox: 0, oy: 0, r: 4.5 + 6 * Math.sqrt(rev / maxRev) });
    }
    // Agencies in the same city would stack exactly; fan them out in a small ring.
    const groups = new Map<string, Marker[]>();
    for (const m of pts) {
      const k = `${Math.round(m.x * 2)}|${Math.round(m.y * 2)}`;
      groups.set(k, [...(groups.get(k) ?? []), m]);
    }
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      g.forEach((m, i) => {
        const ang = (i / g.length) * Math.PI * 2 - Math.PI / 2;
        const rad = 6 + g.length * 1.6;
        m.ox = Math.cos(ang) * rad;
        m.oy = Math.sin(ang) * rad;
      });
    }
    // Draw biggest first so small markers stay clickable on top.
    return pts.sort((a, b) => b.r - a.r);
  }, [rows]);

  // Visible window in base-map coordinates (accounts for letterboxing from preserveAspectRatio="meet").
  const s = Math.min(size.w / W, size.h / H) || 1;
  const vx0 = -(size.w / s - W) / 2, vx1 = W - vx0;
  const vy0 = -(size.h / s - H) / 2, vy1 = H - vy0;
  const bx0 = (vx0 - t.x) / t.k, bx1 = (vx1 - t.x) / t.k, by0 = (vy0 - t.y) / t.k, by1 = (vy1 - t.y) / t.k;
  // A region button lists exactly that region's states; free panning lists whatever is on screen.
  const inView = markers
    .filter((m) =>
      region && region !== "All"
        ? byAbbr[m.a.state]?.region === region
        : m.x >= bx0 && m.x <= bx1 && m.y >= by0 && m.y <= by1
    )
    .map((m) => m.a)
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  const unmapped = rows.length - markers.length;

  const toScreen = (m: Marker) => {
    const [x, y] = t.apply([m.x, m.y]);
    return { x: x + m.ox, y: y + m.oy };
  };
  const sr = svgRef.current?.getBoundingClientRect();
  const wr = wrapRef.current?.getBoundingClientRect();
  const svgOff = { x: sr && wr ? sr.left - wr.left : 0, y: sr && wr ? sr.top - wr.top : 0 };
  const toPx = (x: number, y: number) => ({ left: svgOff.x + (x - vx0) * s, top: svgOff.y + (y - vy0) * s });

  const zoomToBox = ([[x0, y0], [x1, y1]]: [[number, number], [number, number]], pad = 0.85) => {
    const svg = svgRef.current, z = zoomRef.current;
    if (!svg || !z || !isFinite(x0)) return;
    const visW = vx1 - vx0, visH = vy1 - vy0;
    const k = Math.min(14, pad / Math.max((x1 - x0) / visW, (y1 - y0) / visH));
    const next = zoomIdentity.translate(W / 2, H / 2).scale(Math.max(1, k)).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    select(svg).transition().duration(750).call(z.transform, next);
  };

  const goRegion = (r: Region | "All") => {
    if (r === "All") {
      const svg = svgRef.current, z = zoomRef.current;
      if (svg && z) select(svg).transition().duration(750).call(z.transform, zoomIdentity);
    } else zoomToBox(regionBounds(r));
    // Set after the transition starts (programmatic zoom events have no sourceEvent).
    setRegion(r);
  };

  const fitTargets = () => {
    if (!markers.length) return;
    const xs = markers.map((m) => m.x), ys = markers.map((m) => m.y);
    zoomToBox([[Math.min(...xs) - 20, Math.min(...ys) - 20], [Math.max(...xs) + 20, Math.max(...ys) + 20]], 0.9);
    setRegion(null);
  };

  const zoomBy = (f: number) => {
    const svg = svgRef.current, z = zoomRef.current;
    if (svg && z) select(svg).transition().duration(300).call(z.scaleBy, f);
    setRegion(null); // the list now follows whatever is on screen
  };

  const center = projection.invert?.([(W / 2 - t.x) / t.k, (H / 2 - t.y) / t.k]);
  const hovered = markers.find((m) => m.a.id === hover);
  const showLabels = t.k >= 2.4;
  const dotScale = 1 / Math.sqrt(t.k);
  // "Zoomed" = a region button is active or the user has zoomed in by hand.
  const zoomed = (region !== null && region !== "All") || t.k >= 1.6;
  // Fade the dot matrix as you zoom so state lines and cities read clearly.
  const dotOpacity = t.k < 1.4 ? 1 : Math.max(0.3, 1.4 / t.k);

  return (
    <div className="mapgrid">
      <div className="card mapcard plus" ref={wrapRef} style={{ position: "relative" }}>
        <div className="map-regions" role="toolbar" aria-label="Zoom to region">
          {(["All", ...REGIONS] as const).map((r) => (
            <button key={r} className={region === r ? "on" : ""} onClick={() => goRegion(r)}>{r === "All" ? "All US" : r}</button>
          ))}
          <button onClick={fitTargets}>Fit targets</button>
        </div>
        <div className="map-zoom">
          <button className="iconbtn" onClick={() => zoomBy(1.6)} aria-label="Zoom in"><IconPlus /></button>
          <button className="iconbtn" onClick={() => zoomBy(1 / 1.6)} aria-label="Zoom out"><IconMinus /></button>
        </div>

        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Map of target agencies">
          <defs>
            <pattern id="dots" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform={`scale(${dotScale})`}>
              <circle cx="3" cy="3" r="1.15" fill="#9aa1a9" />
            </pattern>
            <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform={`rotate(45) scale(${dotScale})`}>
              <rect width="1.6" height="6" fill="var(--ink-2)" opacity="0.22" />
            </pattern>
          </defs>

          <g transform={t.toString()}>
            {STATE_PATHS.filter((st) => !(zoomed && INSETS.has(st.fips))).map((st) => (
              <path key={st.fips} d={st.d} fill={excluded.has(st.abbr) ? "#ebebea" : "#eef0f2"} />
            ))}
            <path d={zoomed ? LOWER48_D : NATION_D} fill="url(#dots)" opacity={dotOpacity} />
            {STATE_PATHS.filter((st) => excluded.has(st.abbr)).map((st) => (
              <path key={"x" + st.fips} d={st.d} fill="url(#hatch)" />
            ))}
            <path d={BORDERS_D} fill="none" stroke="var(--accent)" strokeOpacity={zoomed ? 0.9 : 0.6} strokeWidth={zoomed ? 1.6 : 1} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <path d={zoomed ? LOWER48_D : NATION_D} fill="none" stroke="var(--accent-ink)" strokeOpacity={0.75} strokeWidth={zoomed ? 1.8 : 1.3} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </g>

          {/* State abbreviations and reference cities appear in regional / zoomed views. */}
          {zoomed && (
            <g style={{ pointerEvents: "none" }} fontFamily="var(--mono)">
              {STATE_PATHS.filter((st) => st.abbr && !INSETS.has(st.fips) && isFinite(st.c[0])).map((st) => {
                const [x, y] = t.apply(st.c);
                return (
                  <text key={"l" + st.fips} x={x} y={y} textAnchor="middle" fontSize={13} fontWeight={600} letterSpacing="0.12em" fill="var(--accent-ink)" fillOpacity={0.32}>
                    {st.abbr}
                  </text>
                );
              })}
              {CITIES.filter((c) => c.s !== "AK" && c.s !== "HI" && (c.t === 1 || t.k >= 3.2)).map((c) => {
                const [x, y] = t.apply(c.p);
                if (x < vx0 - 40 || x > vx1 + 40 || y < vy0 - 20 || y > vy1 + 20) return null;
                return (
                  <g key={c.n + c.s} transform={`translate(${x},${y})`}>
                    <rect x={-2} y={-2} width={4} height={4} fill="var(--ink-3)" />
                    <text x={6} y={3.5} fontSize={c.t === 1 ? 10.5 : 9.5} fill="var(--ink-3)" stroke="var(--surface)" strokeWidth={3} paintOrder="stroke" style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {c.n}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* Markers live outside the zoom group so they stay a constant size on screen. */}
          <g>
            {markers.map((m) => {
              const { x, y } = toScreen(m);
              const st = effectiveStatus(m.a, statuses);
              const active = hover === m.a.id || props.selected === m.a.id;
              const lost = st === "Lost";
              return (
                <g
                  key={m.a.id}
                  transform={`translate(${x},${y})`}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHover(m.a.id)}
                  onMouseLeave={() => setHover((h) => (h === m.a.id ? null : h))}
                  onClick={() => props.onOpen(m.a.id)}
                  role="button"
                  aria-label={`${m.a.name}, ${st}`}
                >
                  {(m.ox || m.oy) && <line x1={0} y1={0} x2={-m.ox} y2={-m.oy} stroke="#9aa1a9" strokeWidth={0.75} />}
                  {active && <circle r={m.r + 5} fill="none" stroke="var(--accent)" strokeWidth={1.25} />}
                  <circle
                    r={m.r}
                    fill={lost ? "#fff" : STATUS_COLOR[st]}
                    fillOpacity={lost ? 1 : 0.92}
                    stroke={lost ? "var(--st-lost)" : "#fff"}
                    strokeWidth={lost ? 1.5 : 1.25}
                  />
                  {m.a.priority === "A" && !lost && <circle r={1.6} fill="#fff" />}
                  {showLabels && (
                    <text x={m.r + 5} y={3.5} fontFamily="var(--mono)" fontSize={10} fill="var(--ink)" stroke="var(--surface)" strokeWidth={3} paintOrder="stroke" style={{ textTransform: "uppercase", pointerEvents: "none" }}>
                      {m.a.name.length > 26 ? m.a.name.slice(0, 25) + "…" : m.a.name}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* HUD */}
        <div className="map-hud" style={{ left: "50%", top: 12, transform: "translateX(-50%)" }}>N</div>
        <div className="map-hud" style={{ right: 12, bottom: 12, textAlign: "right" }}>
          {center ? `${Math.abs(center[1]).toFixed(2)}°${center[1] >= 0 ? "N" : "S"}  ${Math.abs(center[0]).toFixed(2)}°W` : "—"}
          <br />
          ZOOM {t.k.toFixed(1)}×
        </div>
        <div className="map-legend">
          {STATUSES.map((st) => (
            <span key={st}><StatusDot status={st} /> {st}</span>
          ))}
          {excluded.size > 0 && (
            <span><svg width="12" height="12" aria-hidden><rect width="12" height="12" fill="#ebebea" /><path d="M0 12L12 0M-3 3L3 -3M9 15L15 9" stroke="var(--ink-2)" strokeOpacity=".35" strokeWidth="1.6" /></svg> Excluded</span>
          )}
          <span style={{ color: "var(--ink-3)" }}>● size = revenue</span>
        </div>

        {hovered && (() => {
          const { x, y } = toScreen(hovered);
          const pos = toPx(x, y - hovered.r);
          return (
            <div className="tooltip" style={pos}>
              <div style={{ fontWeight: 600 }}>#{pad2(hovered.a.rank)} {hovered.a.name}</div>
              <div className="t2">{hovered.a.city}, {hovered.a.state} · {money(hovered.a.revenueLow, hovered.a.revenueHigh)} · {effectiveStatus(hovered.a, statuses)}</div>
            </div>
          );
        })()}
      </div>

      <div className="card inview">
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line-soft)" }}>
          <div className="label">In view{region && region !== "All" ? ` · ${region}` : region === "All" ? " · All US" : ""}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
            <span className="big-count">{pad2(inView.length)}</span>
            <span className="label">of {markers.length} mapped</span>
          </div>
          {unmapped > 0 && <div className="label" style={{ marginTop: 6, color: "var(--accent-ink)" }}>{unmapped} without a location</div>}
        </div>
        <div className="inview-list">
          {inView.map((a) => (
            <button
              key={a.id}
              className={`inview-row${hover === a.id ? " hl" : ""}`}
              onMouseEnter={() => setHover(a.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => props.onOpen(a.id)}
            >
              <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{pad2(a.rank)}</span>
              <span style={{ minWidth: 0 }}>
                <div className="nm">{a.name}</div>
                <div className="sub">{a.city}, {a.state} · {money(a.revenueLow, a.revenueHigh)}</div>
              </span>
              <StatusDot status={effectiveStatus(a, statuses)} />
            </button>
          ))}
          {!inView.length && <div className="empty" style={{ padding: 16 }}>No targets in this area. Zoom out or pick a region.</div>}
        </div>
      </div>
    </div>
  );
}
