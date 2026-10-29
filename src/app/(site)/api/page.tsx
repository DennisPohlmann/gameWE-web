import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApiReference } from "@/components/api-reference";
import { Section } from "@/components/ui";
import { apiEnabled } from "@/lib/api-switch";
import { basePath } from "@/lib/base-path";
import { getDict } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.api };
}

// Documentation of the public JSON API (/api/v1/...): the OpenAPI document
// from src/lib/openapi.ts, rendered by Scalar with examples in curl, PHP,
// Python and JavaScript. 404 while API_ENABLED is off.
export default async function ApiPage() {
  if (!apiEnabled()) notFound();
  const { t } = await getDict();
  const spec = `${basePath}/api/openapi.json`;
  return (
    <>
      <Section title={t.api}>
        <p className="lead">
          {t.apiIntro}{" "}
          <a href={spec}>openapi.json</a>
        </p>
        <noscript>
          <p>{t.apiNoScript}</p>
        </noscript>
      </Section>
      <section className="section api-section">
        <ApiReference script={`${basePath}/vendor/scalar/standalone.js`} spec={spec} />
      </section>
    </>
  );
}
