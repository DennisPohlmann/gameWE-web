import type { Metadata } from "next";
import { Section, TableWrap } from "@/components/ui";
import { getDict } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.licenses };
}

// [name, link, license, use in German, use in English]; the license name
// links to its text (LICENSE_URL).
type Row = [string, string, string, string, string];

const LICENSE_URL: Record<string, string> = {
  MIT: "https://opensource.org/license/mit",
  "MPL-2.0": "https://www.mozilla.org/en-US/MPL/2.0/",
  "BSD-2-Clause": "https://opensource.org/license/bsd-2-clause",
  "GPL-2.0-or-later": "https://www.gnu.org/licenses/old-licenses/gpl-2.0.html",
  "SIL OFL 1.1": "https://openfontlicense.org/open-font-license-official-text/",
  "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
  "GeoLite2 EULA": "https://www.maxmind.com/en/geolite2/eula",
  "ODbL 1.0": "https://opendatacommons.org/licenses/odbl/1-0/",
  "CC BY 3.0": "https://creativecommons.org/licenses/by/3.0/",
  "CC BY-SA 3.0": "https://creativecommons.org/licenses/by-sa/3.0/",
};

const SOFTWARE: Row[] = [
  ["Next.js", "https://github.com/vercel/next.js", "MIT", "Webserver und Seiten", "Web server and pages"],
  ["React, React DOM", "https://github.com/facebook/react", "MIT", "Oberfläche", "User interface"],
  ["Satori, resvg (@vercel/og)", "https://github.com/vercel/satori", "MPL-2.0", "Signatur- und Serverbanner-Bilder", "Signature and server banner pictures"],
  ["Leaflet", "https://leafletjs.com", "BSD-2-Clause", "Weltkarte der Spieler", "World map of the players"],
  ["mysql2", "https://github.com/sidorares/node-mysql2", "MIT", "MySQL/MariaDB-Zugriff", "MySQL/MariaDB access"],
  ["node-postgres (pg)", "https://github.com/brianc/node-postgres", "MIT", "PostgreSQL-Zugriff", "PostgreSQL access"],
  ["uqr", "https://github.com/unjs/uqr", "MIT", "QR-Code für TOTP", "QR code for TOTP"],
  ["server-only", "https://www.npmjs.com/package/server-only", "MIT", "Schutz serverseitiger Module", "Guard for server-side modules"],
  ["HLstatsX: Community Edition", "https://github.com/NomisCZ/hlstatsx-community-edition", "GPL-2.0-or-later", "Grundlage des Datenbankschemas", "Basis of the database schema"],
];

const ASSETS: Row[] = [
  ["flag-icons (Panayiotis Lipiridis)", "https://github.com/lipis/flag-icons", "MIT", "Länderflaggen", "Country flags"],
  ["HLstatsX: Community Edition", "https://github.com/NomisCZ/hlstatsx-community-edition", "GPL-2.0-or-later", "Waffenbilder (Credits in THIRD-PARTY-LICENSES.md)", "Weapon images (credits in THIRD-PARTY-LICENSES.md)"],
  ["Geist (Vercel)", "https://github.com/vercel/geist-font", "SIL OFL 1.1", "Schrift in Signatur und Banner", "Font in signature and banner"],
];

// Licenses of the software, data and graphics gameWE uses.
export default async function LicensesPage() {
  const { lang, t } = await getDict();
  const { geoipCredit } = await getSettings();
  const de = lang === "de";
  const data: Row[] = [
    ...(geoipCredit === "dbip"
      ? ([["IP to City Lite (DB-IP.com)", "https://db-ip.com", "CC BY 4.0", "Land und Stadt der Spieler; IP Geolocation by DB-IP", "Country and city of the players; IP Geolocation by DB-IP"]] as Row[])
      : []),
    ...(geoipCredit === "maxmind"
      ? ([
          [
            "GeoLite2 (MaxMind)",
            "https://www.maxmind.com",
            "GeoLite2 EULA",
            "Land und Stadt der Spieler. This product includes GeoLite2 data created by MaxMind, available from https://www.maxmind.com.",
            "Country and city of the players. This product includes GeoLite2 data created by MaxMind, available from https://www.maxmind.com.",
          ],
        ] as Row[])
      : []),
    ["OpenStreetMap", "https://www.openstreetmap.org/copyright", "ODbL 1.0", "Kartendaten (© OpenStreetMap contributors)", "Map data (© OpenStreetMap contributors)"],
    ["CARTO basemaps", "https://carto.com/attributions", "CC BY 3.0", "Kartenkacheln, je nach Kartenstil", "Map tiles, depending on the map style"],
    ["OpenTopoMap", "https://opentopomap.org/about", "CC BY-SA 3.0", "Kartenkacheln im Stil Topo", "Map tiles of the topo style"],
    ["Humanitarian OSM Team, OSM France", "https://www.hotosm.org/", "CC0 / ODbL", "Kartenkacheln im Stil HOT", "Map tiles of the HOT style"],
  ];
  const table = (rows: Row[]) => (
    <TableWrap>
      <table className="lic-table">
        <thead>
          <tr>
            <th>{t.licName}</th>
            <th>{t.licLicense}</th>
            <th>{t.licUse}</th>
            <th>{t.licLink}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, url, license, useDe, useEn]) => (
            <tr key={name}>
              <td>{name}</td>
              <td className="nowrap">
                {LICENSE_URL[license] ? (
                  <a href={LICENSE_URL[license]} rel="noopener noreferrer" target="_blank">
                    {license}
                  </a>
                ) : (
                  license
                )}
              </td>
              <td>{de ? useDe : useEn}</td>
              <td className="wrap-cell">
                <a href={url} rel="noopener noreferrer" target="_blank">
                  {url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
  return (
    <>
      <Section title={t.licenses}>
        <p className="lead">{t.licIntro}</p>
      </Section>
      <Section title={t.licSoftware}>{table(SOFTWARE)}</Section>
      <Section title={t.licData}>{table(data)}</Section>
      <Section title={t.licAssets}>{table(ASSETS)}</Section>
    </>
  );
}
