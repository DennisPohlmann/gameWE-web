"use client";

import { useEffect, useRef, useState } from "react";

// A "select all" box for the checkboxes called name in the same form: it
// ticks or clears them all and shows whether all (or some) are ticked.
// Without JavaScript it is not shown.
export function CheckAll({ name, label }: { name: string; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [js, setJs] = useState(false);
  useEffect(() => {
    const me = ref.current;
    const form = me?.form;
    if (!me || !form) return;
    const boxes = () => [...form.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${name}"]`)];
    const sync = () => {
      const on = boxes().filter((b) => b.checked).length;
      me.checked = on === boxes().length;
      me.indeterminate = on > 0 && !me.checked;
    };
    setJs(true);
    sync();
    form.addEventListener("change", sync);
    return () => form.removeEventListener("change", sync);
  }, [name]);
  return (
    <label className="check" hidden={!js}>
      <input
        ref={ref}
        type="checkbox"
        onChange={(e) => {
          for (const b of e.currentTarget.form?.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${name}"]`) ?? []) b.checked = e.currentTarget.checked;
        }}
      />{" "}
      <b>{label}</b>
    </label>
  );
}
