import "server-only";
import { cached, TTL } from "@/lib/cache";
import type { MediaSource, ReleaseStatus, WorkKind } from "@/generated/prisma/client";

const API_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p";

export const TMDB_LANGUAGE = "zh-CN";

export function isTmdbConfigured(): boolean {
  return Boolean(process.env.TMDB_API_READ_TOKEN);
}

export function tmdbImage(path: string | null | undefined, size: "w185" | "w342" | "w500" | "w780" | "original" = "w500"): string | null {
  if (!path) return null;
  return `${IMAGE_BASE}/${size}${path}`;
}

export function tmdbUrl(kind: WorkKind, id: string): string {
  return kind === "MOVIE" ? `https://www.themoviedb.org/movie/${id}` : `https://www.themoviedb.org/tv/${id}`;
}

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

// ---------------------------------------------------------------------------
// Raw payload shapes
// ---------------------------------------------------------------------------

type GenreRef = { id: number; name: string };

type TmdbSearchItem = {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  genre_ids?: number[];
  vote_average?: number;
};

type TmdbMovieDetail = {
  id: number;
  title: string;
  original_title: string;
  overview?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string | null;
  runtime?: number | null;
  genres?: GenreRef[];
  status?: string;
  homepage?: string | null;
  imdb_id?: string | null;
};

type TmdbSeason = {
  id: number;
  season_number: number;
  name?: string;
  episode_count?: number | null;
  air_date?: string | null;
  poster_path?: string | null;
};

type TmdbTvDetail = {
  id: number;
  name: string;
  original_name: string;
  overview?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  first_air_date?: string | null;
  number_of_seasons?: number | null;
  number_of_episodes?: number | null;
  episode_run_time?: number[];
  genres?: GenreRef[];
  status?: string;
  homepage?: string | null;
  seasons?: TmdbSeason[];
  external_ids?: { imdb_id?: string | null; tvdb_id?: number | null } | null;
};

// ---------------------------------------------------------------------------
// Normalised shapes shared with the AniList client
// ---------------------------------------------------------------------------

export type NormalizedGenre = { slug: string; name: string };

export type NormalizedSeason = {
  seasonNumber: number;
  title: string | null;
  posterUrl: string | null;
  totalEpisodes: number | null;
  airedDate: string | null;
  externalKey: string;
};

export type NormalizedMedia = {
  kind: WorkKind;
  source: MediaSource;
  externalKey: string;
  titleZh: string | null;
  titleOriginal: string;
  titleEn: string | null;
  /** 作者 / 主演，仅书籍、漫画、播客等手工录入来源会填。 */
  author: string | null;
  overview: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseDate: string | null;
  runtimeMin: number | null;
  releaseStatus: ReleaseStatus | null;
  totalSeasons: number | null;
  siteUrl: string;
  genres: NormalizedGenre[];
  seasons: NormalizedSeason[];
};

/** Lightweight shape for search result lists. */
export type SearchItem = {
  source: "TMDB" | "ANILIST";
  externalKey: string;
  kind: WorkKind;
  title: string;
  subtitle: string | null;
  overview: string | null;
  posterUrl: string | null;
  releaseDate: string | null;
  genres: NormalizedGenre[];
  siteUrl: string;
  extra: string | null;
};

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = process.env.TMDB_API_READ_TOKEN;
  if (!token) {
    throw new UpstreamError("未配置 TMDB_API_READ_TOKEN", 401);
  }

  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("language", TMDB_LANGUAGE);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new UpstreamError(`TMDB ${res.status}: ${body.slice(0, 200)}`, res.status);
  }
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Genre lists
// ---------------------------------------------------------------------------

function slugifyGenre(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `g-${Buffer.from(name).toString("hex").slice(0, 8)}`;
}

async function getGenreMaps(): Promise<{ movie: Map<number, GenreRef>; tv: Map<number, GenreRef> }> {
  return cached("tmdb:genres", TTL.genreList, async () => {
    const [movie, tv] = await Promise.all([
      tmdbFetch<{ genres: GenreRef[] }>("/genre/movie/list"),
      tmdbFetch<{ genres: GenreRef[] }>("/genre/tv/list"),
    ]);
    return {
      movie: new Map(movie.genres.map((g) => [g.id, g])),
      tv: new Map(tv.genres.map((g) => [g.id, g])),
    };
  });
}

async function mapGenreIds(ids: number[] | undefined, kind: WorkKind): Promise<NormalizedGenre[]> {
  if (!ids?.length) return [];
  const maps = await getGenreMaps();
  const map = kind === "MOVIE" ? maps.movie : maps.tv;
  return ids
    .map((id) => map.get(id))
    .filter((g): g is GenreRef => Boolean(g))
    .map((g) => ({ slug: slugifyGenre(g.name), name: g.name }));
}

function mapGenres(genres: GenreRef[] | undefined): NormalizedGenre[] {
  return (genres ?? []).map((g) => ({ slug: slugifyGenre(g.name), name: g.name }));
}

function mapReleaseStatus(status: string | undefined): ReleaseStatus | null {
  if (!status) return null;
  switch (status) {
    case "Ended":
      return "FINISHED";
    case "Canceled":
      return "CANCELLED";
    case "Returning Series":
    case "In Production":
    case "Planned":
    case "Pilot":
      return "ONGOING";
    default:
      return null;
  }
}

function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function searchTmdb(query: string, page = 1): Promise<SearchItem[]> {
  const key = `tmdb:search:${TMDB_LANGUAGE}:${query}:${page}`;
  return cached(key, TTL.search, async () => {
    const data = await tmdbFetch<{ results: TmdbSearchItem[] }>("/search/multi", {
      query,
      page: String(page),
      include_adult: "false",
    });

    const usable = data.results.filter(
      (r) => (r.media_type === "movie" || r.media_type === "tv") && !!(r.title || r.name),
    );
    const kinds = usable.map((r) => (r.media_type === "movie" ? "MOVIE" : "TV") as WorkKind);
    const genreLists = await Promise.all(
      usable.map((r, i) => mapGenreIds(r.genre_ids, kinds[i])),
    );

    return usable.map((r, i) => {
      const kind = kinds[i];
      const localized = (kind === "MOVIE" ? r.title : r.name) ?? "";
      const original = (kind === "MOVIE" ? r.original_title : r.original_name) ?? localized;
      const date = kind === "MOVIE" ? r.release_date : r.first_air_date;
      return {
        source: "TMDB",
        externalKey: String(r.id),
        kind,
        title: localized || original,
        subtitle: original !== localized ? original : null,
        overview: r.overview ?? null,
        posterUrl: tmdbImage(r.poster_path, "w342"),
        releaseDate: date ?? null,
        genres: genreLists[i],
        siteUrl: tmdbUrl(kind, String(r.id)),
        extra: kind === "TV" ? "剧集" : "电影",
      } satisfies SearchItem;
    });
  });
}

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

export async function getTmdbMovie(id: string): Promise<NormalizedMedia> {
  const detail = await tmdbFetch<TmdbMovieDetail>(`/movie/${id}`);
  return {
    kind: "MOVIE",
    source: "TMDB",
    externalKey: String(detail.id),
    titleZh: detail.title === detail.original_title ? null : detail.title,
    titleOriginal: detail.original_title,
    titleEn: null,
    author: null,
    overview: detail.overview ?? null,
    posterUrl: tmdbImage(detail.poster_path),
    backdropUrl: tmdbImage(detail.backdrop_path, "w780"),
    releaseDate: toIsoDate(detail.release_date),
    runtimeMin: detail.runtime ?? null,
    releaseStatus: mapReleaseStatus(detail.status),
    totalSeasons: null,
    siteUrl: detail.homepage || tmdbUrl("MOVIE", String(detail.id)),
    genres: mapGenres(detail.genres),
    seasons: [],
  };
}

export async function getTmdbTv(id: string): Promise<NormalizedMedia> {
  const detail = await tmdbFetch<TmdbTvDetail>(`/tv/${id}`);

  const seasons: NormalizedSeason[] = (detail.seasons ?? [])
    .filter((s) => s.season_number > 0)
    .sort((a, b) => a.season_number - b.season_number)
    .map((s) => ({
      seasonNumber: s.season_number,
      title: s.name?.trim() || null,
      posterUrl: tmdbImage(s.poster_path, "w342"),
      totalEpisodes: s.episode_count ?? null,
      airedDate: toIsoDate(s.air_date),
      externalKey: `tmdb:${detail.id}:${s.season_number}`,
    }));

  return {
    kind: "TV",
    source: "TMDB",
    externalKey: String(detail.id),
    titleZh: detail.name === detail.original_name ? null : detail.name,
    titleOriginal: detail.original_name,
    titleEn: null,
    author: null,
    overview: detail.overview ?? null,
    posterUrl: tmdbImage(detail.poster_path),
    backdropUrl: tmdbImage(detail.backdrop_path, "w780"),
    releaseDate: toIsoDate(detail.first_air_date),
    runtimeMin: detail.episode_run_time?.[0] ?? null,
    releaseStatus: mapReleaseStatus(detail.status),
    totalSeasons: detail.number_of_seasons ?? (seasons.length || null),
    siteUrl: detail.homepage || tmdbUrl("TV", String(detail.id)),
    genres: mapGenres(detail.genres),
    seasons,
  };
}
