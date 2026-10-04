import "server-only";
import { cached, TTL } from "@/lib/cache";
import { UpstreamError } from "@/lib/tmdb";
import type { NormalizedGenre, NormalizedMedia, NormalizedSeason, SearchItem } from "@/lib/tmdb";
import type { ReleaseStatus, WatchStatus } from "@/generated/prisma/client";

const ENDPOINT = "https://graphql.anilist.co";
const SEASON_ORDER: Record<string, number> = { WINTER: 1, SPRING: 4, SUMMER: 7, FALL: 10 };

export function isAnilistConfigured(): boolean {
  return true;
}

// ---------------------------------------------------------------------------
// Low-level GraphQL client with 429 handling
// ---------------------------------------------------------------------------

async function gql<T>(query: string, variables: Record<string, unknown> = {}, attempt = 0): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 1800 },
  });

  if (res.status === 429) {
    if (attempt >= 2) {
      throw new UpstreamError("AniList 限流中，请稍后再试", 429);
    }
    const retryAfter = Number(res.headers.get("Retry-After") ?? "0");
    const reset = Number(res.headers.get("X-RateLimit-Reset") ?? "0");
    const waitMs = retryAfter > 0 ? retryAfter * 1000 : reset > 0 ? Math.max(0, reset * 1000 - Date.now()) : 5000;
    await new Promise((r) => setTimeout(r, Math.min(waitMs, 15_000)));
    return gql<T>(query, variables, attempt + 1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new UpstreamError(`AniList ${res.status}: ${body.slice(0, 300)}`, res.status);
  }

  const payload = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (payload.errors?.length) {
    throw new UpstreamError(`AniList: ${payload.errors[0].message}`, 502);
  }
  if (!payload.data) throw new UpstreamError("AniList 返回空数据", 502);
  return payload.data;
}

// ---------------------------------------------------------------------------
// Raw payload shapes
// ---------------------------------------------------------------------------

/**
 * AniList's `MediaTitle` exposes `romaji`, `english`, `native` and
 * `userPreferred`. There is no dedicated Chinese field, so `userPreferred` is
 * used as the "localised title" slot: AniList resolves it from the caller's
 * display-language preference, which yields a Chinese title when the upstream
 * provides one and falls back to romaji/english otherwise.
 */
type AnilistTitles = {
  romaji: string | null;
  english: string | null;
  native: string | null;
  userPreferred: string | null;
};

type FuzzyDate = { year: number | null; month: number | null; day: number | null } | null;

type RelationEdge = {
  relationType: string | null;
  node: {
    id: number;
    type: string;
    title: AnilistTitles;
    season: string | null;
    seasonYear: number | null;
    episodes: number | null;
  };
};

type AnilistMedia = {
  id: number;
  type: string;
  format: string | null;
  status: string | null;
  episodes: number | null;
  duration: number | null;
  averageScore: number | null;
  isAdult: boolean | null;
  genres: string[] | null;
  siteUrl: string | null;
  title: AnilistTitles;
  description: string | null;
  coverImage: { large: string | null; medium: string | null; color: string | null } | null;
  bannerImage: string | null;
  startDate: FuzzyDate;
  endDate: FuzzyDate;
  season: string | null;
  seasonYear: number | null;
  relations?: { edges: RelationEdge[] } | null;
  nextAiringEpisode?: { episode: number } | null;
};

const MEDIA_CORE = `
  id
  type
  format
  status
  episodes
  duration
  averageScore
  isAdult
  genres
  siteUrl
  title { romaji english native userPreferred }
  description(asHtml: false)
  coverImage { large medium color }
  bannerImage
  startDate { year month day }
  endDate { year month day }
  season
  seasonYear
  nextAiringEpisode { episode }
`;

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function anilistStatus(status: string | null | undefined): ReleaseStatus | null {
  switch (status) {
    case "FINISHED":
      return "FINISHED";
    case "RELEASING":
    case "NOT_YET_RELEASED":
      return "ONGOING";
    case "CANCELLED":
      return "CANCELLED";
    case "HIATUS":
      return "ONGOING";
    default:
      return null;
  }
}

function anilistListStatus(status: string | null | undefined): WatchStatus {
  switch (status) {
    case "CURRENT":
    case "REPEATING":
      return "WATCHING";
    case "COMPLETED":
      return "COMPLETED";
    case "DROPPED":
      return "DROPPED";
    case "PAUSED":
      return "ON_HOLD";
    default:
      return "PLANNING";
  }
}

function toIso(d: FuzzyDate): string | null {
  if (!d?.year) return null;
  const month = d.month ?? 1;
  const day = d.day ?? 1;
  const date = new Date(Date.UTC(d.year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function anilistGenres(genres: string[] | null | undefined): NormalizedGenre[] {
  return (genres ?? []).map((g) => ({
    slug: g.toLowerCase().replace(/[^a-z0-9]+/g, "-") || g,
    name: g,
  }));
}

function sortKey(m: AnilistMedia): [number, number, number] {
  const year = m.startDate?.year ?? m.seasonYear ?? 99999;
  const month = m.startDate?.month ?? (m.season ? SEASON_ORDER[m.season] : undefined) ?? 99;
  return [year, month, m.id];
}

function firstTitle(...values: (string | null | undefined)[]): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "未命名";
}

/** romaji is the canonical original title for AniList entries. */
function originalTitle(t: AnilistTitles): string {
  return firstTitle(t.romaji, t.english, t.native, t.userPreferred);
}

/**
 * The localised title slot, only populated when AniList actually offers
 * something other than the original title.
 */
function localisedTitle(t: AnilistTitles, fallback: string): string | null {
  const preferred = t.userPreferred?.trim();
  if (preferred && preferred !== fallback) return preferred;
  const native = t.native?.trim();
  if (native && native !== fallback && /[぀-ヿ一-鿿]/.test(native)) return native;
  return null;
}

function toNormalized(m: AnilistMedia, seasons: NormalizedSeason[]): NormalizedMedia {
  const romaji = originalTitle(m.title);
  const english = m.title.english?.trim() || null;
  const id = `AniList #${m.id}`;

  return {
    kind: "ANIME",
    source: "ANILIST",
    externalKey: String(m.id),
    titleZh: localisedTitle(m.title, romaji),
    titleOriginal: romaji || id,
    titleEn: english && english !== romaji ? english : null,
    overview: m.description?.trim() ? m.description.trim() : null,
    posterUrl: m.coverImage?.large ?? m.coverImage?.medium ?? null,
    backdropUrl: m.bannerImage ?? null,
    releaseDate: toIso(m.startDate),
    runtimeMin: m.duration ?? null,
    releaseStatus: anilistStatus(m.status),
    totalSeasons: seasons.length > 1 ? seasons.length : null,
    siteUrl: m.siteUrl ?? `https://anilist.co/anime/${m.id}`,
    genres: anilistGenres(m.genres),
    seasons,
  };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function searchAnilist(query: string, page = 1): Promise<SearchItem[]> {
  return cached(`anilist:search:${query}:${page}`, TTL.search, async () => {
    const data = await gql<{ Page: { media: AnilistMedia[] | null } }>(
      `query ($search: String, $page: Int) {
        Page(page: $page, perPage: 20) {
          media(search: $search, type: ANIME, isAdult: false, sort: [SEARCH_MATCH]) {
            ${MEDIA_CORE}
          }
        }
      }`,
      { search: query, page },
    );

    return (data.Page.media ?? []).map((m) => {
      const romaji = originalTitle(m.title);
      const title = localisedTitle(m.title, romaji) ?? romaji;
      return {
        source: "ANILIST",
        externalKey: String(m.id),
        kind: "ANIME",
        title,
        subtitle: romaji !== title ? romaji : null,
        overview: m.description?.replace(/\s+/g, " ").trim().slice(0, 400) || null,
        posterUrl: m.coverImage?.medium ?? m.coverImage?.large ?? null,
        releaseDate: toIso(m.startDate),
        genres: anilistGenres(m.genres),
        siteUrl: m.siteUrl ?? `https://anilist.co/anime/${m.id}`,
        extra: [
          m.format,
          m.episodes ? `${m.episodes} 集` : null,
          m.averageScore ? `${Math.round(m.averageScore / 10)} 分` : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
      };
    }) satisfies SearchItem[];
  });
}

// ---------------------------------------------------------------------------
// Series resolution (AniList models every season as a separate media)
// ---------------------------------------------------------------------------

async function fetchMediaByIds(ids: number[]): Promise<Map<number, AnilistMedia>> {
  const map = new Map<number, AnilistMedia>();
  // `id_in` lets us resolve every season of a franchise in a single request,
  // which matters a lot given the 30 req/min degraded rate limit.
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const data = await gql<{ Page: { media: AnilistMedia[] | null } }>(
      `query ($ids: [Int]) {
        Page(page: 1, perPage: 50) {
          media(id_in: $ids, type: ANIME) { ${MEDIA_CORE} }
        }
      }`,
      { ids: chunk },
    );
    for (const m of data.Page.media ?? []) map.set(m.id, m);
  }
  return map;
}

export type AnilistSeries = {
  root: AnilistMedia;
  seasons: AnilistMedia[];
};

/** Collect the root plus every PREQUEL/SEQUENT sibling, ordered oldest first. */
export async function getAnilistSeries(rootId: number): Promise<AnilistSeries> {
  return cached(`anilist:series:${rootId}`, TTL.detail, async () => {
    const rootData = await gql<{ Media: AnilistMedia | null }>(
      `query ($id: Int) {
        Media(id: $id, type: ANIME) {
          ${MEDIA_CORE}
          relations {
            edges {
              relationType(version: 2)
              node { id type title { romaji english native userPreferred } season seasonYear episodes }
            }
          }
        }
      }`,
      { id: rootId },
    );

    const root = rootData.Media;
    if (!root) throw new UpstreamError(`AniList 未找到作品 ${rootId}`, 404);

    const siblingIds = new Set<number>();
    for (const edge of root.relations?.edges ?? []) {
      if (edge.relationType !== "PREQUEL" && edge.relationType !== "SEQUENT") continue;
      if (edge.node.type !== "ANIME") continue;
      siblingIds.add(edge.node.id);
    }
    siblingIds.delete(root.id);

    if (siblingIds.size === 0) return { root, seasons: [root] };

    const map = await fetchMediaByIds([...siblingIds]);
    const seasons = [root, ...[...map.values()]].sort((a, b) => {
      const [ay, am, ai] = sortKey(a);
      const [by, bm, bi] = sortKey(b);
      return ay - by || am - bm || ai - bi;
    });

    return { root, seasons };
  });
}

/** Normalised work for an anime, with each season as its own `Season` row. */
export async function getAnilistMedia(id: number): Promise<NormalizedMedia> {
  const { root, seasons } = await getAnilistSeries(id);

  const normalizedSeasons: NormalizedSeason[] = seasons.map((m, index) => ({
    seasonNumber: index + 1,
    title: originalTitle(m.title),
    posterUrl: m.coverImage?.medium ?? m.coverImage?.large ?? null,
    totalEpisodes: m.episodes ?? null,
    airedDate: toIso(m.startDate),
    externalKey: `anilist:${m.id}`,
  }));

  return toNormalized(root, normalizedSeasons);
}

// ---------------------------------------------------------------------------
// User list import
// ---------------------------------------------------------------------------

export type AnilistListEntry = {
  entryId: number;
  mediaId: number;
  status: WatchStatus;
  progress: number;
  score: number | null;
};

export async function getAnilistUserList(userName: string): Promise<AnilistListEntry[]> {
  return cached(`anilist:list:${userName}`, TTL.userList, async () => {
    const data = await gql<{
      MediaListCollection: {
        lists: { name: string; entries: AnilistListEntryRaw[] }[];
      } | null;
    }>(
      `query ($userName: String) {
        MediaListCollection(userName: $userName, type: ANIME) {
          lists {
            name
            entries {
              id
              status
              progress
              score(format: POINT_10)
              media { id }
            }
          }
        }
      }`,
      { userName },
    );

    const lists = data.MediaListCollection?.lists ?? [];
    return lists
      .flatMap((list) => list.entries)
      .map((e) => ({
        entryId: e.id,
        mediaId: e.media?.id ?? 0,
        status: anilistListStatus(e.status),
        progress: e.progress ?? 0,
        score: e.score ? Math.round(e.score / 10) : null,
      }))
      .filter((e) => e.mediaId > 0);
  });
}

type AnilistListEntryRaw = {
  id: number;
  status: string | null;
  progress: number | null;
  score: number | null;
  media: { id: number } | null;
};

export async function fetchAnilistMediaMap(ids: number[]): Promise<Map<number, AnilistMedia>> {
  if (ids.length === 0) return new Map();
  return fetchMediaByIds(ids);
}

export function anilistMediaToNormalized(m: AnilistMedia): NormalizedMedia {
  const romaji = originalTitle(m.title);
  return toNormalized(m, [
    {
      seasonNumber: 1,
      title: romaji,
      posterUrl: m.coverImage?.medium ?? m.coverImage?.large ?? null,
      totalEpisodes: m.episodes ?? null,
      airedDate: toIso(m.startDate),
      externalKey: `anilist:${m.id}`,
    },
  ]);
}
