import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { PlaceTable, RankingTable } from "@/components/ranking";
import { PlaceSelect } from "@/components/place-select";
import { Empty, Flag, Pager, Section, pageParam, strParam, ROW_OPTIONS, rowsParam } from "@/components/ui";
import { noAutofill } from "@/lib/autofill";
import { getSettings } from "@/lib/settings";
import { AutoForm } from "@/components/auto-form";
import { MapGate } from "@/components/map-gate";
import { mapGateProps } from "@/lib/consent-server";
import { mapSatellite } from "@/lib/map-styles";
import {
  getCityOptions,
  getCountryOptions,
  getMapPlayers,
  getPlayerLiveServers,
  getPlaceRanking,
  getRanking,
  getStateOptions,
  placeSorts,
  rankingSorts,
  type PlaceSort,
  type RankingSort,
} from "@/lib/data";
import { mapMarkers } from "@/lib/map-markers";
import { parsePlaceQuery, placeTypes } from "@/lib/places";
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

  const rawView = strParam(sp.view);
  const view = rawView === "new" || rawView === "inactive" ? rawView : "";
  const inactive = view === "inactive";
  const mapAll = strParam(sp.map) === "all";
  // Country, state and city rankings, with gameME's parameters (see places.ts).
  // The inactive players are one plain list, without them.
  const { type: placeType, country, state, city } = parsePlaceQuery(inactive ? {} : {
    type: strParam(sp.type),
    valuecountry: strParam(sp.valuecountry),
    valuestate: strParam(sp.valuestate),
    valuecity: strParam(sp.valuecity),
  });
  const placeKind = placeType ? placeTypes[placeType] : "";
  const placeList =
    (placeKind === "country" && !country) || (placeKind === "state" && !state) || (placeKind === "city" && !city);
  const rawSort = strParam(sp.sort);
  const sort: RankingSort = sortParam(rankingSorts, rawSort, view === "new" ? "new" : inactive ? "activity" : "skill");
  const placeSort: PlaceSort = sortParam(placeSorts, rawSort, PLACE_SORT_DEFAULT);
  const asc = strParam(sp.dir) === "asc";
  const q = strParam(sp.q);
  const page = pageParam(sp.page);
  const settings = await getSettings();
  const { pageSize, activityDays, mapPlayers: showMap, mapStyle } = settings;
  const limit = rowsParam(sp.rows, pageSize);

  const [{ rows, total }, places, mapPlayers, countries, states, cities] = await Promise.all([
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
          state,
          city,
          inactive,
        }),
    placeList && placeKind
      ? getPlaceRanking({
          game,
          kind: placeKind,
          country,
          sort: placeSort,
          asc,
          limit,
          offset: (page - 1) * limit,
        })
      : null,
    // The map follows the filter: the players of one country, state or city.
    showMap ? getMapPlayers(game, mapAll ? MAP_ALL_LIMIT : MAP_LIMIT, placeList && placeKind === "country" ? {} : { country, state, city }, "skill") : [],
    getCountryOptions(game),
    placeKind === "state" ? getStateOptions(game, country) : [],
    placeKind === "city" ? getCityOptions(game, country) : [],
  ]);
  // The players map shows only players, no servers and no lines to them
  // (the other maps keep them). On the top 10 the hover box of a player who
  // is online right now names their server; all players skip that lookup.
  const online = mapAll ? new Map<number, { serverId: number; server: string }>() : await getPlayerLiveServers(game, mapPlayers.map((p) => p.playerId));
  const markers = mapMarkers(
    mapPlayers.map((p) => ({ ...p, ...online.get(p.playerId) })),
    game,
    t,
    lang,
  );
  const gate = await mapGateProps(mapStyle);
  const pages = Math.max(1, Math.ceil((places ? places.total : total) / limit));
  const base = `/${game}/players`;
  const keep = {
    view: view || undefined,
    q: q || undefined,
    sort: rawSort || undefined,
    dir: asc ? "asc" : undefined,
    type: placeType || undefined,
    valuecountry: country || undefined,
    valuestate: state || undefined,
    valuecity: city || undefined,
    map: mapAll ? "all" : undefined,
    rows: limit !== pageSize ? limit : undefined,
  };
  const rowOptions = { value: limit, options: ROW_OPTIONS };
  // Rank numbers are positions only in the unfiltered points ranking (or
  // the points ranking of one country, state or city).
  const showRank = sort === "skill" && !asc && !q && !inactive;
  const local = !!(country || state || city);
  const countryName = countries.find((c) => c.code === country)?.name || country.toUpperCase();
  const cityOptions = cities.map((c) => ({
    value: country ? c.city.toLowerCase() : `${c.code}:${c.city.toLowerCase()}`,
    label: country ? c.city : `${c.city} (${c.code.toUpperCase()})`,
    players: c.players,
  }));
  const cityName = cities.find((c) => c.city.toLowerCase() === city && (!country || c.code === country))?.city || city;
  const stateOptions = states.map((c) => ({
    value: country ? c.state.toLowerCase() : `${c.code}:${c.state.toLowerCase()}`,
    label: country ? c.state : `${c.state} (${c.code.toUpperCase()})`,
    players: c.players,
  }));
  const stateName = states.find((c) => c.state.toLowerCase() === state && (!country || c.code === country))?.state || state;
  const placeForm = (
    // Keyed by the filter, so the selects show it again after a change.
    <PlaceSelect key={`${placeType}|${country}|${state}|${city}`} action={base}>
      <select {...noAutofill} name="type" defaultValue={placeType} aria-label={t.rankingType}>
        <option value="">{t.playerRanking}</option>
        <option value="countryinfo">{t.countryRanking}</option>
        <option value="stateinfo">{t.stateRanking}</option>
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
      {placeKind === "state" ? (
        <select {...noAutofill} name="valuestate" defaultValue={state && (country ? state : "")} aria-label={t.placeState}>
          <option value="">{t.allStates}</option>
          {stateOptions.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label} [{fmtNum(c.players, lang)}]
            </option>
          ))}
        </select>
      ) : null}
      {placeKind === "city" ? (
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
            <MapGate {...gate} markers={markers} style={mapStyle} satellite={mapSatellite(settings, t)} />
            <p className="muted">
              {fill(mapAll ? t.playerMapHint : t.playerMapHintTop, {
                n: fmtNum(markers.length, lang),
              })}
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
              className={view === "new" ? "active" : undefined}
            >
              {t.newPlayers}
            </Link>
            <Link
              href={`${base}?view=inactive`}
              className={inactive ? "active" : undefined}
            >
              {t.inactivePlayers}
            </Link>
          </span>
        }
        aside={
          <>
          {inactive ? null : placeForm}
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
            {state ? <input type="hidden" name="valuestate" value={state} /> : null}
            {city ? <input type="hidden" name="valuecity" value={city} /> : null}
            <button type="submit">{t.search}</button>
          </Form>
          </>
        }
      >
        {places && placeKind ? (
          places.rows.length ? (
            <>
              <PlaceTable
                game={game}
                rows={places.rows}
                kind={placeKind}
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
            {inactive ? <p className="lead">{t.inactiveHint}</p> : null}
            {local ? (
              <p className="lead">
                <Flag code={country} />
                {fill(t.playersIn, { place: city ? cityName : state ? stateName : countryName })}
              </p>
            ) : null}
            <RankingTable
              game={game}
              rows={rows}
              firstRank={(page - 1) * limit + 1}
              showRank={showRank}
              showFirstConnect={view === "new"}
              showLastSeen={inactive}
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
