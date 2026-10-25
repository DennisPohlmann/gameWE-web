"use client";

import Form from "next/form";
import type { ChangeEvent, ReactNode } from "react";

// Selects for the country, state and city rankings. A change loads the new
// ranking at once; the button stays for browsers without JavaScript. A new
// kind of ranking or a new country drops the chosen state or city, as it
// would not fit.
export function PlaceSelect({ action, children }: { action: string; children: ReactNode }) {
  const onChange = (e: ChangeEvent<HTMLFormElement>) => {
    const form = e.currentTarget;
    const target = e.nativeEvent.target;
    const name = target instanceof HTMLSelectElement ? target.name : "";
    if (name === "type" || name === "valuecountry") {
      for (const place of ["valuestate", "valuecity"]) {
        const el = form.elements.namedItem(place);
        if (el instanceof HTMLSelectElement) el.value = "";
      }
    }
    // Empty selects stay out of the address (?type=cityinfo instead of
    // ?type=cityinfo&valuecountry=&valuecity=).
    for (const el of Array.from(form.elements)) {
      if (el instanceof HTMLSelectElement && !el.value) el.disabled = true;
    }
    form.requestSubmit();
  };
  return (
    <Form className="search place-select" action={action} onChange={onChange}>
      {children}
    </Form>
  );
}
