"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Hides its content in the admin area (the root layout is shared).
export function NotOnAdmin({ children }: { children: ReactNode }) {
  return usePathname().startsWith("/admin") ? null : children;
}
