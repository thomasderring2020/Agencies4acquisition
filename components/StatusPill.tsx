"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { STATUSES, type Status } from "@/lib/types";
import { STATUS_COLOR, STATUS_KEY } from "@/lib/format";

export function StatusDot({ status }: { status: Status }) {
  return <span className={`dot ${STATUS_KEY[status]}`} style={{ background: STATUS_COLOR[status] }} />;
}

/**
 * Status button with a dropdown. The menu renders in a portal with fixed positioning so it is
 * never clipped by the scrolling table or covered by the sticky status column.
 */
export default function StatusPill({ value, onChange }: { value: Status; onChange: (s: Status) => void }) {
  const [pos, setPos] = useState<React.CSSProperties | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = pos !== null;

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        btnRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    menuRef.current?.querySelector<HTMLButtonElement>('button[aria-checked="true"]')?.focus();
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  const toggle = () => {
    if (open) return setPos(null);
    const r = btnRef.current!.getBoundingClientRect();
    const up = r.bottom + 230 > window.innerHeight;
    setPos({
      position: "fixed",
      right: Math.max(8, window.innerWidth - r.right),
      ...(up ? { top: "auto", bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4, bottom: "auto" }),
    });
  };

  return (
    <div className="status" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        className={`status-btn ${STATUS_KEY[value]}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Status: ${value}. Change status`}
        onClick={toggle}
      >
        <StatusDot status={value} />
        {value}
        <span className="caret">▾</span>
      </button>
      {open &&
        createPortal(
          <div className="menu" role="menu" ref={menuRef} style={{ ...pos, zIndex: 60 }} onClick={(e) => e.stopPropagation()}>
            {STATUSES.map((s) => (
              <button
                key={s}
                role="menuitemradio"
                aria-checked={s === value}
                onClick={() => {
                  setPos(null);
                  if (s !== value) onChange(s);
                }}
              >
                <StatusDot status={s} />
                {s}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
