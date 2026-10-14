"use client";
import { useState } from "react";

export default function Login() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: pw }) });
    if (res.ok) {
      window.location.href = "/";
      return;
    }
    const j = await res.json().catch(() => ({}));
    setErr(j.error || "Sign-in failed");
    setBusy(false);
  }

  return (
    <main className="login">
      <div className="login-dots" aria-hidden />
      <form className="login-card plus" onSubmit={submit}>
        <div className="label">M&amp;A Watch / Targets</div>
        <h1>Target Tracker</h1>
        <p className="muted" style={{ margin: "0 0 20px", fontSize: 13.5 }}>
          Prospective agency acquisitions. Enter the team password to continue.
        </p>
        <div className="input">
          <label className="label" htmlFor="pw">Team password</label>
          <input id="pw" type="password" autoFocus autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        {err && <div className="err" style={{ marginTop: 10 }}>{err}</div>}
        <button className="btn accent" style={{ marginTop: 16, width: "100%", justifyContent: "center", height: 36 }} disabled={busy || !pw}>
          {busy ? <span className="spin" /> : null} Enter
        </button>
      </form>
    </main>
  );
}
