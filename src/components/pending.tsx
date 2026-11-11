"use client";

import { useLinkStatus } from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// A mark inside a <Link> while its page is loading (pager arrows): the click
// shows at once, before the server answers.
export function LinkPending() {
  const { pending } = useLinkStatus();
  return pending ? <span className="link-pending" aria-hidden="true" /> : null;
}

// For the GET forms whose selects load a new page (AutoForm, PlaceSelect):
// true from the submit until the address has changed. A submit that leads to
// the same address (nothing changed) stops after 10 s at the latest.
export function useSubmitPending(): [boolean, () => void] {
  const [pending, setPending] = useState(false);
  const at = `${usePathname()}?${useSearchParams().toString()}`;
  useEffect(() => setPending(false), [at]);
  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(() => setPending(false), 10_000);
    return () => clearTimeout(id);
  }, [pending]);
  return [pending, () => setPending(true)];
}
