import type { Metadata } from "next";
import { SortableTable } from "@/components/sortable-table";
import { Section, TableWrap } from "@/components/ui";
import { getDict } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import npm from "@/lib/npm-licenses.json";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.licenses };
}

// [name, link, license, use in German, use in English]; the license name
// links to its text (LICENSE_URL).
type Row = [string, string, string, string, string];

// The npm packages: generated from package-lock.json by scripts/licenses.mjs
// (before every build; npm test fails when the file is stale).
type NpmRow = { name: string; version: string; license: string; platform?: boolean; note?: string };
const NPM = npm as NpmRow[];

// The version shown after a name of the lists below, from the npm list.
const VERSION_OF: Record<string, string> = {
  "Next.js": "next",
  "React, React DOM": "react",
  "Satori, resvg (@vercel/og)": "@vercel/og",
  Leaflet: "leaflet",
  mysql2: "mysql2",
  "node-postgres (pg)": "pg",
  "Scalar API Reference": "@scalar/api-reference",
  uqr: "uqr",
  "server-only": "server-only",
};

function withVersion(name: string): string {
  const v = NPM.find((r) => r.name === VERSION_OF[name])?.version;
  return v ? `${name} ${v}` : name;
}

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
  "CC BY-NC-SA 4.0": "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

const SOFTWARE: Row[] = [
  ["Next.js", "https://github.com/vercel/next.js", "MIT", "Webserver und Seiten", "Web server and pages"],
  ["React, React DOM", "https://github.com/facebook/react", "MIT", "Oberfläche", "User interface"],
  ["Satori, resvg (@vercel/og)", "https://github.com/vercel/satori", "MPL-2.0", "Signatur- und Serverbanner-Bilder", "Signature and server banner pictures"],
  ["Yoga (in @vercel/og)", "https://github.com/facebook/yoga", "MIT", "Layout der Signatur- und Bannerbilder", "Layout of the signature and banner pictures"],
  ["Leaflet", "https://leafletjs.com", "BSD-2-Clause", "Weltkarte der Spieler", "World map of the players"],
  ["mysql2", "https://github.com/sidorares/node-mysql2", "MIT", "MySQL/MariaDB-Zugriff", "MySQL/MariaDB access"],
  ["node-postgres (pg)", "https://github.com/brianc/node-postgres", "MIT", "PostgreSQL-Zugriff", "PostgreSQL access"],
  ["Scalar API Reference", "https://github.com/scalar/scalar", "MIT", "API-Dokumentation unter /api", "API documentation on /api"],
  ["uqr", "https://github.com/unjs/uqr", "MIT", "QR-Code für TOTP", "QR code for TOTP"],
  ["server-only", "https://www.npmjs.com/package/server-only", "MIT", "Schutz serverseitiger Module", "Guard for server-side modules"],
  ["HLstatsX: Community Edition", "https://github.com/NomisCZ/hlstatsx-community-edition", "GPL-2.0-or-later", "Grundlage des Datenbankschemas", "Basis of the database schema"],
  ["HLstatsX:CE mit CS2-Unterstützung (lovasatt)", "https://github.com/lovasatt/hlstatsx-community-edition", "GPL-2.0-or-later", "Vorlage für die Counter-Strike-2-Unterstützung", "Reference for the Counter-Strike 2 support"],
];

const ASSETS: Row[] = [
  ["flag-icons (Panayiotis Lipiridis)", "https://github.com/lipis/flag-icons", "MIT", "Länderflaggen", "Country flags"],
  ["Geist (Vercel)", "https://github.com/vercel/geist-font", "SIL OFL 1.1", "Schrift in Signatur und Banner", "Font in signature and banner"],
  ["Feather Icons (Cole Bemis)", "https://github.com/feathericons/feather", "MIT", "Symbole im Admin-Bereich (teils nachgezeichnet)", "Icons in the admin area (partly redrawn)"],
];

// Licenses of the software, data and graphics gameWE uses.
export default async function LicensesPage() {
  const { lang, t } = await getDict();
  const { geoipCredit, mapSatellite } = await getSettings();
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
    ["Steam Web API (Valve)", "https://steamcommunity.com/dev/apiterms", "Steam Web API Terms of Use", "Steam-Namen, Profilbilder und VAC-Status", "Steam names, profile pictures and VAC status"],
    ["OpenStreetMap", "https://www.openstreetmap.org/copyright", "ODbL 1.0", "Kartendaten (© OpenStreetMap contributors)", "Map data (© OpenStreetMap contributors)"],
    ["CARTO basemaps", "https://carto.com/attributions", "CC BY 3.0", "Kartenkacheln, je nach Kartenstil", "Map tiles, depending on the map style"],
    ["OpenTopoMap", "https://opentopomap.org/about", "CC BY-SA 3.0", "Kartenkacheln im Stil Topo", "Map tiles of the topo style"],
    ["Humanitarian OSM Team, OSM France", "https://www.hotosm.org/", "CC0 / ODbL", "Kartenkacheln im Stil HOT", "Map tiles of the HOT style"],
    ...(mapSatellite === "eox"
      ? ([
          [
            "Sentinel-2 cloudless (EOX IT Services GmbH)",
            "https://s2maps.eu",
            "CC BY-NC-SA 4.0",
            "Satellitenansicht der Spielerkarten (enthält veränderte Copernicus-Sentinel-Daten), Beschriftung aus OpenStreetMap-Daten",
            "Satellite view of the player maps (contains modified Copernicus Sentinel data), labels from OpenStreetMap data",
          ],
        ] as Row[])
      : []),
    ...(mapSatellite === "esri"
      ? ([["Esri World Imagery", "https://www.esri.com/en-us/legal/terms/full-master-agreement", "Esri", "Satellitenansicht der Spielerkarten mit Beschriftung", "Satellite view of the player maps with labels"]] as Row[])
      : []),
  ];
  const table = (rows: Row[]) => (
    <TableWrap>
      {/* In the order of the list until a head is clicked. */}
      <SortableTable
        className="lic-table"
        initial={-1}
        cols={[{ label: t.licName }, { label: t.licLicense, className: "nowrap" }, { label: t.licUse }, { label: t.licLink, className: "wrap-cell" }]}
        rows={rows.map(([name, url, license, useDe, useEn]) => {
          const link = url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
          return {
            key: name,
            values: [withVersion(name), license, de ? useDe : useEn, link],
            cells: [
              withVersion(name),
              LICENSE_URL[license] ? (
                <a key="l" href={LICENSE_URL[license]} rel="noopener noreferrer" target="_blank">
                  {license}
                </a>
              ) : (
                license
              ),
              de ? useDe : useEn,
              <a key="u" href={url} rel="noopener noreferrer" target="_blank">
                {link}
              </a>,
            ],
          };
        })}
      />
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
      <Section title={t.licNpm}>
        <p className="lead">{t.licNpmIntro}</p>
        <TableWrap>
          <SortableTable
            className="lic-table"
            initial={0}
            cols={[{ label: t.licName }, { label: t.licVersion, className: "nowrap" }, { label: t.licLicense }]}
            rows={NPM.map((r) => ({
              key: `${r.name}@${r.version}`,
              values: [r.name, r.version, r.license],
              cells: [
                <a key="n" href={`https://www.npmjs.com/package/${r.name}/v/${r.version}`} rel="noopener noreferrer" target="_blank">
                  {r.name}
                </a>,
                r.version,
                r.platform ? `${r.license} (${t.licPlatform})` : r.license,
              ],
            }))}
          />
        </TableWrap>
      </Section>
    </>
  );
}
