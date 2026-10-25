import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { PlaceTable, RankingTable } from "@/components/ranking";
import { PlaceSelect } from "@/components/place-select";
import { Empty, Flag, Pager, Section, pageParam, strParam, ROW_OPTIONS, rowsParam } from "@/components/ui";
import { noAutofill } from "@/lib/autofill";
import { getSettings } from "@/lib/settings";
import { AutoForm } from "@/components/auto-form";
import { PlayerMap } from "@/components/player-map";
import {
  getCityOptions,
  getCountryOptions,
  getMapPlayers,
  getMapServers,
  getPlayerLiveServers,
  getPlaceRanking,
  getRanking,
  placeSorts,
  rankingSorts,
  type PlaceSort,
  type RankingSort,
} from "@/lib/data";
import { mapMarkers, serverMarkers } from "@/lib/map-markers";
import { PLACE_SORT_DEFAULT, sortParam } from "@/lib/sorts";
import { fmtNum, localeOf } from "@/lib/format";
import { fill, getDict } from "@/lib/i18n";

// The map shows only the best players by default: many markers load slowly.
// ?map=all shows all of them, up to MAP_ALL_LIMIT.
const MAP_LIMIT = 10;
const MAP_ALL_LIMIT = 1000;

type SP = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: t.players };
}

export default async function PlayersPage({
  params,
  searchParams,
}: {
  params: Promise<{ game: string }>;
  searchParams: SP;
}) {
  const { game } = await params;
  const sp = await searchParams;
  const { lang, t } = await getDict();

  const view = strParam(sp.view) === "new" ? "new" : "";
  const mapAll = strParam(sp.map) === "all";
  // Country and city rankings, with gameME's parameters:
  // ?type=countryinfo[&valuecountry=de], ?type=cityinfo[&valuecity=madrid].
  const rawType = strParam(sp.type);
  const placeType = rawType === "countryinfo" || rawType === "cityinfo" ? rawType : "";
  // The city select sends "de:frankfurt" when no country is chosen, so
  // cities with the same name in two countries stay apart.
  const rawCity = strParam(sp.valuecity).trim().toLowerCase();
  const cityCountry = /^([a-z]{2}):(.+)$/.exec(rawCity);
  const rawCountry = (cityCountry?.[1] ?? strParam(sp.valuecountry)).trim().toLowerCase();
  const country = /^[a-z]{2}$/.test(rawCountry) ? rawCountry : "";
  const cityName0 = cityCountry?.[2] ?? rawCity;
  const city = placeType === "cityinfo" && cityName0.length <= 80 ? cityName0 : "";
  const placeList = (placeType === "countryinfo" && !country) || (placeType === "cityinfo" && !city);
  const rawSort = strParam(sp.sort);
  const sort: RankingSort = sortParam(rankingSorts, rawSort, view === "new" ? "new" : "skill");
  const placeSort: PlaceSort = sortParam(placeSorts, rawSort, PLACE_SORT_DEFAULT);
  const asc = strParam(sp.dir) === "asc";
  const q = strParam(sp.q);
  const page = pageParam(sp.page);
  const { pageSize, activityDays, mapPlayers: showMap, mapStyle } = await getSettings();
  const limit = rowsParam(sp.rows, pageSize);

  const [{ rows, total }, places, mapPlayers, mapServers, countries, cities] = await Promise.all([
    placeList
      ? { rows: [], total: 0 }
      : getRanking({
          game,
          sort,
          asc,
          search: q,
          limit,
          offset: (page - 1) * limit,
          country,
          city,
        }),
    placeList
      ? getPlaceRanking({
          game,
          cities: placeType === "cityinfo",
          country,
          sort: placeSort,
          asc,
          limit,
          offset: (page - 1) * limit,
        })
      : null,
    // The map follows the filter: the players of one country or city.
    showMap ? getMapPlayers(game, mapAll ? MAP_ALL_LIMIT : MAP_LIMIT, placeList && placeType === "countryinfo" ? {} : { country, city }, "skill") : [],
    showMap ? getMapServers(game) : [],
    getCountryOptions(game),
    placeType === "cityinfo" ? getCityOptions(game, country) : [],
  ]);
  // The top 10 map joins each player who is online right now to their
  // server, as the live map does; with all players the lines would cover
  // the map.
  const online = mapAll ? new Map<number, { serverId: number; server: string }>() : await getPlayerLiveServers(game, mapPlayers.map((p) => p.playerId));
  const markers = mapMarkers(
    mapPlayers.map((p) => ({ ...p, ...online.get(p.playerId) })),
    game,
    t,
    lang,
  );
  const serverPins = serverMarkers(mapServers, game, t);
  const pages = Math.max(1, Math.ceil((places ? places.total : total) / limit));
  const base = `/${game}/players`;
  const keep = {
    view: view || undefined,
    q: q || undefined,
    sort: rawSort || undefined,
    dir: asc ? "asc" : undefined,
    type: placeType || undefined,
    valuecountry: country || undefined,
    valuecity: city || undefined,
    map: mapAll ? "all" : undefined,
    rows: limit !== pageSize ? limit : undefined,
  };
  const rowOptions = { value: limit, options: [...new Set([pageSize, ...ROW_OPTIONS])].sort((a, b) => a - b) };
  // Rank numbers are positions only in the unfiltered points ranking (or
  // the points ranking of one country or city).
  const showRank = sort === "skill" && !asc && !q;
  const local = !!(country || city);
  const countryName = countries.find((c) => c.code === country)?.name || country.toUpperCase();
  const cityOptions = cities.map((c) => ({
    value: country ? c.city.toLowerCase() : `${c.code}:${c.city.toLowerCase()}`,
    label: country ? c.city : `${c.city} (${c.code.toUpperCase()})`,
    players: c.players,
  }));
  const cityName = cities.find((c) => c.city.toLowerCase() === city && (!country || c.code === country))?.city || city;
  const placeForm = (
    // Keyed by the filter, so the selects show it again after a change.
    <PlaceSelect key={`${placeType}|${country}|${city}`} action={base}>
      <select {...noAutofill} name="type" defaultValue={placeType} aria-label={t.rankingType}>
        <option value="">{t.playerRanking}</option>
        <option value="countryinfo">{t.countryRanking}</option>
        <option value="cityinfo">{t.cityRanking}</option>
      </select>
      <select {...noAutofill} name="valuecountry" defaultValue={country} aria-label={t.placeCountry}>
        <option value="">{t.allCountries}</option>
        {countries.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name || c.code.toUpperCase()} [{fmtNum(c.players, lang)}]
          </option>
        ))}
      </select>
      {placeType === "cityinfo" ? (
        <select {...noAutofill} name="valuecity" defaultValue={city && (country ? city : "")} aria-label={t.placeCity}>
          <option value="">{t.allCities}</option>
          {cityOptions.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label} [{fmtNum(c.players, lang)}]
            </option>
          ))}
        </select>
      ) : null}
      <button type="submit">{t.show}</button>
    </PlaceSelect>
  );

  return (
    <>
      {markers.length ? (
        <Section
          title={mapAll ? t.playerMap : `${t.playerMap} (${t.mapTop10})`}
          aside={
            <AutoForm action={base} className="search">
              {Object.entries(keep).map(([k, v]) => (k !== "map" && v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
              <select {...noAutofill} name="map" defaultValue={mapAll ? "all" : "top"} aria-label={t.playerMap}>
                <option value="top">{t.mapTop10}</option>
                <option value="all">{t.mapAllPlayers}</option>
              </select>
              <noscript>
                <button type="submit">{t.show}</button>
              </noscript>
            </AutoForm>
          }
        >
          <div className="box">
            <PlayerMap
              markers={markers}
              servers={serverPins}
              style={mapStyle}
            />
            <p className="muted">
              {fill(mapAll ? t.playerMapHint : t.playerMapHintTop, {
                n: fmtNum(markers.length, lang),
              })}
              {serverPins.length ? ` ${t.playerMapServers}` : null}
            </p>
          </div>
        </Section>
      ) : null}
      <Section
        title={
          <span className="subtabs">
            <Link href={base} className={view ? undefined : "active"}>
              {t.ranking}
            </Link>
            <Link
              href={`${base}?view=new`}
              className={view ? "active" : undefined}
            >
              {t.newPlayers}
            </Link>
          </span>
        }
        aside={
          <>
          {placeForm}
          <Form className="search" action={base} role="search">
            {view ? <input type="hidden" name="view" value={view} /> : null}
            <input
              {...noAutofill}
              type="search"
              name="q"
              defaultValue={q}
              placeholder={t.searchPlayer}
              aria-label={t.searchPlayer}
            />
            {placeType ? <input type="hidden" name="type" value={placeType} /> : null}
            {country ? <input type="hidden" name="valuecountry" value={country} /> : null}
            {city ? <input type="hidden" name="valuecity" value={city} /> : null}
            <button type="submit">{t.search}</button>
          </Form>
          </>
        }
      >
        {places ? (
          places.rows.length ? (
            <>
              <PlaceTable
                game={game}
                rows={places.rows}
                cities={placeType === "cityinfo"}
                firstRank={(page - 1) * limit + 1}
                sort={{ current: placeSort, asc, base, params: keep }}
                t={t}
                lang={lang}
              />
              <Pager base={base} params={keep} page={page} pages={pages} total={places.total} rows={rowOptions} locale={localeOf(lang)} labels={t} />
            </>
          ) : (
            <Empty>{t.noData}</Empty>
          )
        ) : rows.length ? (
          <>
            {local ? (
              <p className="lead">
                <Flag code={country} />
                {fill(t.playersIn, { place: city ? cityName : countryName })}
              </p>
            ) : null}
            <RankingTable
              game={game}
              rows={rows}
              firstRank={(page - 1) * limit + 1}
              showRank={showRank}
              showFirstConnect={view === "new"}
              showGlobalRank={local}
              sort={{ current: sort, asc, base, params: keep }}
              activityDays={activityDays}
              t={t}
              lang={lang}
            />
            <Pager base={base} params={keep} page={page} pages={pages} total={total} rows={rowOptions} locale={localeOf(lang)} labels={t} />
          </>
        ) : (
          <Empty>{q ? t.noResults : t.noData}</Empty>
        )}
      </Section>
    </>
  );
}
