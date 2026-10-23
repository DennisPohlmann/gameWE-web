"use client";

import Form from "next/form";
import type { ChangeEvent, ReactNode } from "react";

// A GET form whose selects load the page at once; the button inside stays
// for browsers without JavaScript.
export function AutoForm({ action, className, children }: { action: string; className?: string; children: ReactNode }) {
  const onChange = (e: ChangeEvent<HTMLFormElement>) => {
    if (e.nativeEvent.target instanceof HTMLSelectElement) e.currentTarget.requestSubmit();
  };
  return (
    <Form action={action} className={className} onChange={onChange}>
      {children}
    </Form>
  );
}
