import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { getAdminTheme } from "@/lib/admin-theme";
import { basePath } from "@/lib/base-path";
import { getAdminLang } from "@/lib/i18n";
import "./admin.css";

// Root layout of the admin area: its own page frame and stylesheet, nothing
// from the templates of the public pages (those have the root layout in
// app/(site)). Moving between the two is a full page load.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Admin · gameWE", template: "%s · Admin · gameWE" },
  robots: { index: false, follow: false },
  icons: { icon: [{ url: `${basePath}/icon.svg`, type: "image/svg+xml" }] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#161b26" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0e13" },
  ],
};

export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  const [lang, theme] = await Promise.all([getAdminLang(), getAdminTheme()]);
  return (
    <html lang={lang} data-theme={theme === "auto" ? undefined : theme}>
      <body className="adm">{children}</body>
    </html>
  );
}
