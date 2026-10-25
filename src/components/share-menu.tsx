"use client";

import { useEffect, useRef, useState } from "react";

// Share button for every page: plain share links (no scripts or trackers of
// the networks), copy link, and the device's own share sheet where there is
// one (phones).
type Labels = { share: string; copy: string; copied: string; email: string };

const TARGETS: [string, string, (u: string, t: string) => string][] = [
  ["WhatsApp", "wa", (u, t) => `https://wa.me/?text=${t}%20${u}`],
  ["Facebook", "fb", (u) => `https://www.facebook.com/sharer/sharer.php?u=${u}`],
  ["X", "x", (u, t) => `https://x.com/intent/post?url=${u}&text=${t}`],
  ["Telegram", "tg", (u, t) => `https://t.me/share/url?url=${u}&text=${t}`],
  ["Reddit", "rd", (u, t) => `https://www.reddit.com/submit?url=${u}&title=${t}`],
  ["Bluesky", "bs", (u, t) => `https://bsky.app/intent/compose?text=${t}%20${u}`],
  ["VK", "vk", (u, t) => `https://vk.com/share.php?url=${u}&title=${t}`],
];

// Profile pages set their own share text, e.g. "Check out X on Y: rank 3".
function page() {
  return {
    url: window.location.href,
    title: document.querySelector<HTMLMetaElement>('meta[name="share-text"]')?.content || document.title,
  };
}

function open(make: (u: string, t: string) => string) {
  const { url, title } = page();
  window.open(make(encodeURIComponent(url), encodeURIComponent(title)), "_blank", "noopener,noreferrer");
}

const mail = (u: string, t: string) => `mailto:?subject=${encodeURIComponent(document.title)}&body=${t}%0A%0A${u}`;

function ShareIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );
}

// The share bar at the top of the clan and server pages: the
// share text and every target as its own button, no menu to open first.
export function ShareBar({ labels }: { labels: Labels }) {
  const [copied, setCopied] = useState(false);
  const [native, setNative] = useState(false);
  const [text, setText] = useState("");
  useEffect(() => {
    setNative(typeof navigator.share === "function");
    setText(page().title);
  }, []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(page().url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <div className="share-bar">
      <div className="share-bar-head">
        <ShareIcon size={16} />
        <div>
          <strong>{labels.share}</strong>
          {text ? <span className="share-bar-text">{text}</span> : null}
        </div>
      </div>
      <div className="share-bar-btns">
        {native ? (
          <button type="button" className="share-b native" onClick={() => navigator.share(page()).catch(() => {})}>
            <ShareIcon size={12} />
            {labels.share}
          </button>
        ) : null}
        <button type="button" className="share-b link" onClick={copy}>
          {copied ? labels.copied : labels.copy}
        </button>
        {TARGETS.map(([name, cls, make]) => (
          <button key={cls} type="button" className={`share-b ${cls}`} onClick={() => open(make)}>
            {name}
          </button>
        ))}
        <button type="button" className="share-b mail" onClick={() => open(mail)}>
          {labels.email}
        </button>
      </div>
    </div>
  );
}

// The small share button in the nav bar of every page.
export function ShareMenu({ labels }: { labels: Labels }) {
  const [shown, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [native, setNative] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setNative(typeof navigator.share === "function");
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  const go = (make: (u: string, t: string) => string) => () => {
    open(make);
    setOpen(false);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(page().url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <div className="share-nav" ref={ref}>
      <button type="button" className="share-btn" aria-expanded={shown} aria-haspopup="menu" onClick={() => setOpen(!shown)}>
        <ShareIcon size={12} />
        {labels.share}
      </button>
      {shown ? (
        <div className="share-menu" role="menu">
          <button type="button" role="menuitem" onClick={copy}>
            <i className="share-ic link" />
            {copied ? labels.copied : labels.copy}
          </button>
          {TARGETS.map(([name, cls, make]) => (
            <button key={cls} type="button" role="menuitem" onClick={go(make)}>
              <i className={`share-ic ${cls}`} />
              {name}
            </button>
          ))}
          <button type="button" role="menuitem" onClick={go(mail)}>
            <i className="share-ic mail" />
            {labels.email}
          </button>
          {native ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                navigator.share(page()).catch(() => {});
                setOpen(false);
              }}
            >
              <i className="share-ic more" />
              …
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
