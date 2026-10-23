import { settingGroups } from "./admin-settings";
import type { L } from "./admin-entities";

// What a hlstats_Options key means, for the raw list (Erweitert: alle
// Optionen): the keys of the settings page with their label, help and group,
// and the collector's keys that have no field there.

type Info = { label: L; help?: L; group?: L };

const EXTRA: Record<string, Info> = {
  contact: {
    label: { de: "Kontaktangabe (E-Mail oder URL)", en: "Contact (e-mail or URL)" },
    help: { de: "Aus HLstatsX:CE. Text oder leer.", en: "From HLstatsX:CE. Text or empty." },
  },
  siteurl: {
    label: { de: "Basis-URL der Seite (HLstatsX)", en: "Base URL of the site (HLstatsX)" },
    help: { de: "URL oder leer. Für den Link des Seitennamens gilt „Link des Seitennamens“.", en: "URL or empty. The site name link is \"Link of the site name\"." },
  },
  gamewe_default_game: {
    label: { de: "Spiel, das zuerst gezeigt wird", en: "Game shown first" },
    help: { de: "Ein Ranglisten-Code aus Ranglisten, z. B. css.", en: "A ranking code from Rankings, e.g. css." },
  },
  gamewe_geoip_db: {
    label: { de: "GeoIP-Datenbank (veraltet)", en: "GeoIP database (obsolete)" },
    help: {
      de: "Veraltet, durch geoip.path in der config.yaml des Collectors überschrieben. Kann gelöscht werden.",
      en: "Obsolete, overridden by geoip.path in the collector's config.yaml. Can be deleted.",
    },
  },
  gamewe_ignore_bots: {
    label: { de: "Bots ignorieren (veraltet)", en: "Ignore bots (obsolete)" },
    help: { de: "Ersetzt durch „Bots ranken“. Ein Collector-Update löscht den Schlüssel.", en: "Replaced by \"Rank bots\". A collector update deletes the key." },
  },
  gamewe_daily_awards: {
    label: { de: "Tagesawards (veraltet)", en: "Daily awards (obsolete)" },
    help: { de: "Ersetzt durch features.daily_awards in der config.yaml. Ein Collector-Update löscht den Schlüssel.", en: "Replaced by features.daily_awards in config.yaml. A collector update deletes the key." },
  },
};

const fromSettings = new Map<string, Info>(
  settingGroups.flatMap((g) => g.items.map((s): [string, Info] => [s.key, { label: s.label, help: s.help, group: g.title }])),
);

export function optionInfo(key: string): Info | undefined {
  return fromSettings.get(key) ?? EXTRA[key];
}
