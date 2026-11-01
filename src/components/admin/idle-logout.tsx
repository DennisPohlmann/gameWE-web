"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/admin/icons";
import { countdownText, touchEvery } from "@/lib/admin-idle";

// Automatic sign-out of the admin area (lib/admin-idle.ts): reports
// activity (mouse, keys, touch, scrolling) at most once a minute (a quarter
// of a shorter time) to /admin/session, and activity not reported yet before
// the time in the cookie runs out. When the time is up it asks there first, because
// another tab may have been active meanwhile. Only when the session has no
// time left does the page go to the sign-in, which then shows why.
// `minutes` 0: off, nothing runs. The top bar shows the time left as a
// countdown (m:ss), back to the full time on every activity; another tab's
// activity shows once the server reported it (at the latest at 0).
export function IdleLogout({ minutes, base, label }: { minutes: number; base: string; label: string }) {
  const [left, setLeft] = useState(minutes * 60_000);
  useEffect(() => {
    if (minutes <= 0) return;
    const url = `${base}/admin/session`;
    const limit = minutes * 60_000;
    const every = touchEvery(limit);
    let last = Date.now();
    // The first activity on a freshly loaded page renews the time at once.
    let touched = 0;
    let busy = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => setLeft(Math.max(0, limit - (Date.now() - last)));
    const clock = setInterval(tick, 1_000);

    const leave = () => {
      window.location.assign(`${base}/admin/login?error=idle`);
    };
    const ask = async (method: "GET" | "POST"): Promise<number | null | "gone"> => {
      try {
        const res = await fetch(url, { method, credentials: "same-origin", cache: "no-store" });
        if (res.status === 401) return "gone";
        if (!res.ok) return null;
        const body = (await res.json()) as { left: number | null };
        return typeof body.left === "number" ? body.left : null;
      } catch {
        // Offline or the server restarts: try again on the next check.
        return null;
      }
    };
    const schedule = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(check, Math.max(1_000, Math.min(ms, limit)));
    };
    const check = async () => {
      if (busy) return schedule(5_000);
      busy = true;
      const idle = Date.now() - last;
      if (idle < limit) {
        busy = false;
        // Activity since the last report (not the same moment, e.g. the
        // next mouse move while the report was on its way): report it now,
        // the time in the cookie runs out before the page's time.
        if (last - touched > 1_000) return report();
        schedule(limit - idle);
        return;
      }
      const left = await ask("GET");
      busy = false;
      if (left === "gone") return leave();
      // Another tab kept the session alive: count down its time.
      if (typeof left === "number") last = Date.now() - limit + left;
      tick();
      schedule(left ?? 30_000);
    };
    const report = () => {
      touched = Date.now();
      busy = true;
      void ask("POST").then((left) => {
        busy = false;
        if (left === "gone") leave();
        // Look again shortly before the renewed time runs out.
        else schedule(limit - every);
      });
    };
    const active = () => {
      last = Date.now();
      tick();
      if (busy || last - touched < every) return;
      report();
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart", "mousemove", "scroll"] as const;
    for (const e of events) window.addEventListener(e, active, { passive: true, capture: true });
    // A tab that comes back from the background checks at once.
    const visible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", visible);
    schedule(limit - every);
    return () => {
      clearTimeout(timer);
      clearInterval(clock);
      for (const e of events) window.removeEventListener(e, active, { capture: true });
      document.removeEventListener("visibilitychange", visible);
    };
  }, [minutes, base]);
  if (minutes <= 0) return null;
  return (
    <span className={left <= 60_000 ? "adm-idle soon" : "adm-idle"} title={label} aria-label={`${label}: ${countdownText(left)}`} role="timer">
      <Icon name="clock" />
      <span aria-hidden="true">{countdownText(left)}</span>
    </span>
  );
}
