"use client";

import Form from "next/form";
import type { ChangeEvent, ReactNode } from "react";

// A GET form whose selects load the page at once; the button inside stays
// for browsers without JavaScript. keepScroll stays where the reader is
// instead of jumping to the top, for a choice further down the page.
export function AutoForm({ action, className, keepScroll, children }: { action: string; className?: string; keepScroll?: boolean; children: ReactNode }) {
  const onChange = (e: ChangeEvent<HTMLFormElement>) => {
    if (e.nativeEvent.target instanceof HTMLSelectElement) e.currentTarget.requestSubmit();
  };
  return (
    <Form action={action} className={className} onChange={onChange} scroll={keepScroll ? false : undefined}>
      {children}
    </Form>
  );
}
