"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Agency, Contact, Note, Overrides, Status, StatusRecord } from "@/lib/types";
import { STATUSES } from "@/lib/types";
import { hostOf, linkedinSearch, money, pad2, relTime, shortDate, STATUS_KEY } from "@/lib/format";
import { StatusDot } from "./StatusPill";
import { Meter } from "./ListView";
import type { Toast } from "./TrackerApp";
import { IconClose, IconEdit, IconExt, IconGlobe, IconIn, IconMail, IconPhone, IconPlus, IconTrash } from "./Icons";

interface Props {
  agency: Agency;
  status: Status;
  statusRec?: StatusRecord;
  overrides: Overrides;
  excluded: boolean;
  isNew: boolean;
  user: string;
  onClose: () => void;
  onStatus: (s: Status) => void;
  onOverride: (p: Overrides) => Promise<void> | void;
  onCounts: (c: { contacts: number; notes: number }) => void;
  flash: (t: Toast) => void;
}

const api = (id: string, rest = "") => `/api/agencies/${encodeURIComponent(id)}${rest}`;

export default function DetailPanel(p: Props) {
  const { agency: a } = p;
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [editingLinks, setEditingLinks] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const website = p.overrides.website || a.website;
  const linkedin = p.overrides.linkedin || a.linkedin;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target as HTMLElement).closest("input,textarea")) p.onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let live = true;
    fetch(api(a.id), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => {
        if (!live) return;
        setContacts(j.contacts);
        setNotes(j.notes);
      })
      .catch(() => live && p.flash({ text: "Couldn't load contacts and notes.", bad: true }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.id]);

  const sync = useCallback(
    (c: Contact[] | null, n: Note[] | null) => p.onCounts({ contacts: c?.length ?? 0, notes: n?.length ?? 0 }),
    [p]
  );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      p.flash({ text: "Link copied — teammates will land on this agency." });
    } catch {
      p.flash({ text: window.location.href });
    }
  };

  return (
    <>
      <div className="glass" onClick={p.onClose} aria-hidden>
        <div className="glass-hint">Click to close</div>
      </div>
      <aside className="panel" role="dialog" aria-modal="true" aria-label={`${a.name} details`}>
        <div className="panel-head">
          <div className="panel-top">
            <span className="tag dark">#{pad2(a.rank)}</span>
            {a.priority && <span className="tag">Priority {a.priority}</span>}
            {p.isNew && <span className="tag accent">New this week</span>}
            {p.excluded && <span className="tag warn">Excluded geography</span>}
            {a.sheetStatus && !/^new$/i.test(a.sheetStatus) && <span className={`tag${/pass/i.test(a.sheetStatus) ? " dark" : ""}`}>Research call: {a.sheetStatus}</span>}
            {!a.inSheet && <span className="tag">No longer in sheet</span>}
            <span className="spacer" />
            <button className="btn ghost small" onClick={copyLink}>Copy link</button>
            <button ref={closeRef} className="iconbtn" onClick={p.onClose} aria-label="Close panel"><IconClose /></button>
          </div>

          <div className="panel-title">
            <div style={{ minWidth: 0 }}>
              <h1>{a.name}</h1>
              <div className="where">
                {a.hq || "HQ unknown"}
                {a.targetMarket ? ` · ${a.targetMarket}` : ""}
              </div>
              {!editingLinks ? (
                <div className="links">
                  {website ? (
                    <a className="linkbtn" href={website} target="_blank" rel="noopener noreferrer"><IconGlobe /> {hostOf(website)} <IconExt size={12} /></a>
                  ) : (
                    <button className="linkbtn dashed" onClick={() => setEditingLinks(true)}><IconGlobe /> Add website</button>
                  )}
                  {linkedin ? (
                    <a className="linkbtn" href={linkedin} target="_blank" rel="noopener noreferrer"><IconIn /> LinkedIn <IconExt size={12} /></a>
                  ) : (
                    <>
                      <button className="linkbtn dashed" onClick={() => setEditingLinks(true)}><IconIn /> Add LinkedIn page</button>
                      <a className="linkbtn ghostlink" href={linkedinSearch(a.name)} target="_blank" rel="noopener noreferrer" style={{ border: 0, background: "none", color: "var(--ink-3)" }}>
                        Search LinkedIn <IconExt size={12} />
                      </a>
                    </>
                  )}
                  <button className="iconbtn" style={{ width: 32, height: 32 }} onClick={() => setEditingLinks(true)} aria-label="Edit links" title="Edit links"><IconEdit /></button>
                </div>
              ) : (
                <LinkEditor
                  website={website}
                  linkedin={linkedin}
                  onCancel={() => setEditingLinks(false)}
                  onSave={async (w, l) => {
                    const patch: Overrides = {};
                    if (w !== website) patch.website = w;
                    if (l !== linkedin) patch.linkedin = l;
                    if (Object.keys(patch).length) await p.onOverride(patch);
                    setEditingLinks(false);
                  }}
                />
              )}
            </div>
          </div>
          <div className="statusrow">
            <div className="label">Status</div>
            <div className="seg" role="radiogroup" aria-label="Status">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  role="radio"
                  aria-checked={p.status === s}
                  className={`${STATUS_KEY[s]}${p.status === s ? " on" : ""}`}
                  onClick={() => p.status !== s && p.onStatus(s)}
                >
                  <StatusDot status={s} /> {s}
                </button>
              ))}
            </div>
            <div className="status-meta">
              {p.statusRec ? `Set by ${p.statusRec.by} · ${relTime(p.statusRec.at)}` : "Not reviewed yet"}
            </div>
          </div>
        </div>

        <div className="panel-scroll">
          <div className="fin">
            <div><div className="label">Revenue</div><div className="v">{money(a.revenueLow, a.revenueHigh)}</div><div className="s" title={a.revenueStatus}>{a.revenueStatus || "—"}</div></div>
            <div><div className="label">Scenario EBITDA</div><div className="v">{money(a.ebitdaLow, a.ebitdaHigh)}</div><div className="s">screening assumption</div></div>
            <div><div className="label">Illustrative EV</div><div className="v">{money(a.evLow, a.evHigh)}</div><div className="s">EBITDA × multiple</div></div>
            <div><div className="label">Feasibility</div><div className="v" style={{ display: "flex", alignItems: "center", gap: 8 }}><Meter value={a.feasibility} /><span style={{ fontSize: 15 }}>{a.feasibility || "—"}</span></div><div className="s">deal likelihood</div></div>
            <div><div className="label">Confidence</div><div className="v">{a.confidence || "—"}</div><div className="s">research quality</div></div>
            <div><div className="label">Market tier</div><div className="v wrap" style={{ fontSize: 14, paddingTop: 3 }}>{a.tier || "—"}</div><div className="s">{a.weekAdded ? `Added ${shortDate(a.weekAdded)}` : ""}</div></div>
          </div>

          <div className="cols">
            <div className="stack">
              <section className="block b-thesis">
                <div className="block-h"><div className="label">Investment thesis</div></div>
                <div className="block-b">
                  <Field label="Next diligence step" value={a.nextStep} keyField />
                  <Field label="Relation fit" value={a.fit} />
                  <Field label="Key risk" value={a.risk} />
                </div>
              </section>
              <section className="block b-profile">
                <div className="block-h"><div className="label">Agency profile</div></div>
                <div className="block-b">
                  <Field label="Business / specialty" value={a.specialty} />
                  <Field label="Growth / quality" value={a.growth} />
                  <Field label="Ownership" value={a.ownership} />
                </div>
              </section>
              <section className="block b-basis">
                <div className="block-h"><div className="label">Basis &amp; sources</div></div>
                <dl className="block-b" style={{ margin: 0 }}>
                  <KV k="Revenue basis" v={a.revenueBasis} />
                  <KV k="EBITDA basis" v={a.ebitdaBasis} />
                  <KV k="Primary source" v={a.primarySource} link />
                  <KV k="Secondary source" v={a.secondarySource} link />
                  <KV k="Headquarters" v={a.hq} />
                  <KV k="Mapped at" v={geoLabel(a)} />
                  <KV k="Week added" v={a.weekAdded ? shortDate(a.weekAdded) : ""} />
                  {Object.entries(a.extra).map(([k, v]) => <KV key={k} k={k} v={v} link={/^https?:\/\//.test(v)} />)}
                </dl>
              </section>
            </div>

            <div className="stack">
              <Contacts
                agencyId={a.id}
                contacts={contacts}
                user={p.user}
                flash={p.flash}
                onChange={(c) => {
                  setContacts(c);
                  sync(c, notes);
                }}
              />
              <section className="block b-outreach">
                <div className="block-h"><div className="label">Outreach</div></div>
                <div className="block-b">
                  <Field label="Key decision-makers (research)" value={a.decisionMakers} />
                  <Field label="Suggested introduction path" value={a.outreachPath} />
                </div>
              </section>
              <Notes
                agencyId={a.id}
                notes={notes}
                user={p.user}
                flash={p.flash}
                onChange={(n) => {
                  setNotes(n);
                  sync(contacts, n);
                }}
              />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function geoLabel(a: Agency) {
  if (a.geo === "address") return "Street address";
  if (a.geo === "coords") return "Sheet coordinates";
  if (a.geo === "city") return `City · ${a.city}, ${a.state}`;
  if (a.geo === "state") return `State center · ${a.state} (city not recognized)`;
  return "Not on map (no recognizable location)";
}

function Field({ label, value, keyField }: { label: string; value: string; keyField?: boolean }) {
  if (!value) return null;
  return (
    <div className={`field${keyField ? " key" : ""}`}>
      <div className="label">{label}</div>
      <p>{value}</p>
    </div>
  );
}

function KV({ k, v, link }: { k: string; v: string; link?: boolean }) {
  if (!v) return null;
  return (
    <div className="kv">
      <dt>{k}</dt>
      <dd className="field" style={{ padding: 0, border: 0 }}>
        {link && /^https?:\/\//.test(v) ? <a href={v} target="_blank" rel="noopener noreferrer">{v.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a> : v}
      </dd>
    </div>
  );
}

function LinkEditor(props: { website: string; linkedin: string; onSave: (w: string, l: string) => Promise<void>; onCancel: () => void }) {
  const [w, setW] = useState(props.website);
  const [l, setL] = useState(props.linkedin);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="form"
      style={{ borderBottom: 0, paddingBottom: 0, maxWidth: 640 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await props.onSave(w.trim(), l.trim());
        setBusy(false);
      }}
    >
      <div className="input"><label className="label">Agency website</label><input value={w} onChange={(e) => setW(e.target.value)} placeholder="https://" autoFocus /></div>
      <div className="input"><label className="label">Agency LinkedIn page</label><input value={l} onChange={(e) => setL(e.target.value)} placeholder="https://www.linkedin.com/company/…" /></div>
      <div className="form-actions">
        <button type="button" className="btn ghost small" onClick={props.onCancel}>Cancel</button>
        <button className="btn accent small" disabled={busy}>{busy ? <span className="spin" /> : null} Save links</button>
      </div>
    </form>
  );
}

// ---------------- Contacts ----------------

type ContactFields = Pick<Contact, "name" | "title" | "phone" | "email" | "linkedin">;
const BLANK: ContactFields = { name: "", title: "", phone: "", email: "", linkedin: "" };

function Contacts(props: { agencyId: string; contacts: Contact[] | null; user: string; flash: (t: Toast) => void; onChange: (c: Contact[]) => void }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const list = props.contacts;

  const save = async (fields: ContactFields, id?: string) => {
    const res = await fetch(id ? api(props.agencyId, `/contacts/${id}`) : api(props.agencyId, "/contacts"), {
      method: id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...fields, by: props.user }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Couldn't save contact");
    const next = id ? (list ?? []).map((c) => (c.id === id ? j : c)) : [...(list ?? []), j];
    props.onChange(next);
    setEditing(null);
    props.flash({ text: id ? "Contact updated" : `Contact saved · ${j.name}` });
  };

  const remove = async (c: Contact) => {
    if (!confirm(`Remove ${c.name} from this agency's contacts?`)) return;
    const res = await fetch(api(props.agencyId, `/contacts/${c.id}`), { method: "DELETE" });
    if (!res.ok) return props.flash({ text: "Couldn't remove contact", bad: true });
    props.onChange((list ?? []).filter((x) => x.id !== c.id));
  };

  return (
    <section className="block b-contacts">
      <div className="block-h">
        <div className="label">Contacts · {list?.length ?? "…"}</div>
        {editing !== "new" && (
          <button className="btn accent small" onClick={() => setEditing("new")}><IconPlus size={12} /> Add contact</button>
        )}
      </div>
      <div className="block-b">
        {editing === "new" && <ContactForm initial={BLANK} onCancel={() => setEditing(null)} onSave={(f) => save(f)} />}
        {list === null ? (
          <div className="empty"><span className="spin" /></div>
        ) : !list.length && editing !== "new" ? (
          <div className="empty">No contacts yet. Add the principal or anyone you&apos;ve spoken with.</div>
        ) : (
          list.map((c) =>
            editing === c.id ? (
              <ContactForm key={c.id} initial={c} onCancel={() => setEditing(null)} onSave={(f) => save(f, c.id)} />
            ) : (
              <div className="contact" key={c.id}>
                <div className="avatar">{initials(c.name)}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="nm">{c.name}</div>
                  {c.title && <div className="ti">{c.title}</div>}
                  <div className="ln">
                    {c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}><IconPhone size={12} /> {c.phone}</a>}
                    {c.email && <a href={`mailto:${c.email}`}><IconMail size={12} /> {c.email}</a>}
                    {c.linkedin && <a href={c.linkedin} target="_blank" rel="noopener noreferrer"><IconIn size={12} /> LinkedIn</a>}
                  </div>
                  <div className="by">Added by {c.addedBy} · {shortDate(c.addedAt)}</div>
                </div>
                <div className="row-actions">
                  <button className="iconbtn" style={{ width: 26, height: 26 }} onClick={() => setEditing(c.id)} aria-label={`Edit ${c.name}`}><IconEdit size={12} /></button>
                  <button className="iconbtn" style={{ width: 26, height: 26 }} onClick={() => remove(c)} aria-label={`Remove ${c.name}`}><IconTrash size={12} /></button>
                </div>
              </div>
            )
          )
        )}
      </div>
    </section>
  );
}

function ContactForm({ initial, onSave, onCancel }: { initial: ContactFields; onSave: (f: ContactFields) => Promise<void>; onCancel: () => void }) {
  const [f, setF] = useState<ContactFields>({ name: initial.name, title: initial.title, phone: initial.phone, email: initial.email, linkedin: initial.linkedin });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof ContactFields) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!f.name.trim()) return setErr("Name is required");
        if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return setErr("That email doesn't look right");
        setBusy(true);
        setErr("");
        try {
          await onSave(f);
        } catch (x) {
          setErr((x as Error).message);
          setBusy(false);
        }
      }}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <div className="input"><label className="label">Name *</label><input value={f.name} onChange={set("name")} autoFocus autoComplete="off" /></div>
      <div className="input"><label className="label">Title / role</label><input value={f.title} onChange={set("title")} placeholder="Optional" autoComplete="off" /></div>
      <div className="input"><label className="label">Phone</label><input value={f.phone} onChange={set("phone")} type="tel" autoComplete="off" /></div>
      <div className="input"><label className="label">Email</label><input value={f.email} onChange={set("email")} type="email" autoComplete="off" /></div>
      <div className="input full"><label className="label">LinkedIn profile</label><input value={f.linkedin} onChange={set("linkedin")} placeholder="https://www.linkedin.com/in/…" autoComplete="off" /></div>
      <div className="form-actions">
        {err && <span className="err" style={{ marginRight: "auto", alignSelf: "center" }}>{err}</span>}
        <button type="button" className="btn ghost small" onClick={onCancel}>Cancel</button>
        <button className="btn accent small" disabled={busy}>{busy ? <span className="spin" /> : null} Save contact</button>
      </div>
    </form>
  );
}

const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

// ---------------- Notes ----------------

function Notes(props: { agencyId: string; notes: Note[] | null; user: string; flash: (t: Toast) => void; onChange: (n: Note[]) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const res = await fetch(api(props.agencyId, "/notes"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, by: props.user }),
    });
    setBusy(false);
    if (!res.ok) return props.flash({ text: "Couldn't save note", bad: true });
    const n = await res.json();
    props.onChange([n, ...(props.notes ?? [])]);
    setText("");
  };

  const remove = async (n: Note) => {
    if (!confirm("Delete this note?")) return;
    const res = await fetch(api(props.agencyId, `/notes/${n.id}`), { method: "DELETE" });
    if (!res.ok) return props.flash({ text: "Couldn't delete note", bad: true });
    props.onChange((props.notes ?? []).filter((x) => x.id !== n.id));
  };

  return (
    <section className="block b-notes">
      <div className="block-h"><div className="label">Notes · {props.notes?.length ?? "…"}</div></div>
      <div className="block-b">
        <div style={{ padding: "12px 0", borderBottom: "1px solid var(--line-soft)" }}>
          <textarea
            className="input-area"
            placeholder="Call recap, intro made, next step…  (⌘/Ctrl + Enter to save)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && add()}
            aria-label="New note"
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button className="btn small" onClick={add} disabled={busy || !text.trim()}>{busy ? <span className="spin" /> : null} Add note</button>
          </div>
        </div>
        {props.notes === null ? (
          <div className="empty"><span className="spin" /></div>
        ) : !props.notes.length ? (
          <div className="empty">No notes yet.</div>
        ) : (
          props.notes.map((n) => (
            <div className="note" key={n.id}>
              <div>
                <p>{n.text}</p>
                <div className="by">{n.by} · {relTime(n.at)}</div>
              </div>
              <div className="row-actions">
                <button className="iconbtn" style={{ width: 26, height: 26 }} onClick={() => remove(n)} aria-label="Delete note"><IconTrash size={12} /></button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
