"use client";

import { useEffect, useRef } from "react";

type ScalarApp = { destroy: () => void };
declare global {
  interface Window {
    Scalar?: { createApiReference: (el: HTMLElement, config: Record<string, unknown>) => ScalarApp };
  }
}

// Scalar's colours and font taken from the site's template variables.
const css = `
.scalar-app, .scalar-app .dark-mode, .scalar-app .light-mode {
  --scalar-font: Verdana, Arial, sans-serif;
  --scalar-background-1: var(--surface);
  --scalar-background-2: var(--surface-2);
  --scalar-background-3: var(--row-group);
  --scalar-background-accent: color-mix(in srgb, var(--accent) 15%, transparent);
  --scalar-border-color: var(--border);
  --scalar-color-1: var(--text);
  --scalar-color-2: var(--soft);
  --scalar-color-3: var(--muted);
  --scalar-color-accent: var(--accent-text);
  --scalar-color-green: var(--good);
  --scalar-color-red: var(--bad);
  --scalar-color-blue: var(--series-2);
  --scalar-button-1: var(--accent);
  --scalar-button-1-color: var(--line-text);
  --scalar-sidebar-background-1: var(--panel);
  --scalar-sidebar-color-1: var(--text);
  --scalar-sidebar-color-2: var(--soft);
  --scalar-sidebar-border-color: var(--border);
  --scalar-sidebar-item-active-background: var(--row-group);
  --scalar-sidebar-color-active: var(--accent-text);
  --scalar-sidebar-search-background: var(--surface-2);
  --scalar-sidebar-search-border-color: var(--border);
  --scalar-sidebar-search-color: var(--muted);
}`;

// The API reference rendered by Scalar (self-hosted under /vendor/scalar,
// copied there by scripts/vendor.mjs) from the OpenAPI document `spec`.
// Nothing is loaded from Scalar's servers: no fonts, no telemetry, no
// request proxy, no hosted API client, no AI agent and no MCP link.
export function ApiReference({ script, spec }: { script: string; spec: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let app: ScalarApp | undefined;
    let gone = false;
    const mount = () => {
      if (gone || !el.current || !window.Scalar) return;
      app = window.Scalar.createApiReference(el.current, {
        // As a source, so the agent setting is not dropped (Scalar turns its
        // AI agent on for localhost otherwise).
        sources: [{ url: spec, agent: { disabled: true } }],
        layout: "modern",
        theme: "none",
        forceDarkModeState: "dark",
        hideDarkModeToggle: true,
        withDefaultFonts: false,
        telemetry: false,
        hideClientButton: true,
        showDeveloperTools: "never",
        mcp: { disabled: true },
        documentDownloadType: "json",
        defaultHttpClient: { targetKey: "shell", clientKey: "curl" },
        featuredClients: ["shell/curl", "php/curl", "python/requests", "js/fetch"],
        // curl, PHP, Python and JavaScript; the other languages are hidden.
        hiddenClients: {
          c: true, clojure: true, csharp: true, dart: true, fsharp: true, go: true, http: true, java: true, julia: true,
          kotlin: true, objc: true, ocaml: true, powershell: true, r: true, ruby: true, rust: true, swift: true,
          node: true, shell: ["httpie", "wget"], php: ["guzzle"], python: ["httpx_sync", "httpx_async"],
        },
        customCss: css,
      });
    };
    let tag = document.querySelector<HTMLScriptElement>(`script[src="${script}"]`);
    if (window.Scalar) mount();
    else {
      if (!tag) {
        tag = document.createElement("script");
        tag.src = script;
        tag.async = true;
        document.head.appendChild(tag);
      }
      tag.addEventListener("load", mount, { once: true });
    }
    return () => {
      gone = true;
      tag?.removeEventListener("load", mount);
      app?.destroy();
    };
  }, [script, spec]);
  return <div ref={el} className="api-ref" />;
}
