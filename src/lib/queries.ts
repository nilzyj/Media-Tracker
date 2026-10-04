import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import type { Prisma, WatchStatus, WorkKind } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Shared selections
// ---------------------------------------------------------------------------

const mediaCardSelect = {
  id: true,
  kind: true,
  source: true,
  titleZh: true,
  titleOriginal: true,
  titleEn: true,
  author: true,
  posterUrl: true,
  releaseDate: true,
  runtimeMin: true,
  totalSeasons: true,
  siteUrl: true,
} satisfies Prisma.MediaSelect;

const seasonEntrySelect = {
  id: true,
  status: true,
  progress: true,
  totalEpisodes: true,
  score: true,
  rewatchCount: true,
  lastWatchedAt: true,
  finishedAt: true,
  season: {
    select: {
      id: true,
      seasonNumber: true,
      title: true,
      totalEpisodes: true,
      posterUrl: true,
    },
  },
} satisfies Prisma.SeasonEntrySelect;

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export type ContinueItem = {
  seasonEntryId: string;
  entryId: string;
  media: Prisma.MediaGetPayload<{ select: typeof mediaCardSelect }>;
  season: { id: string; seasonNumber: number; title: string | null; totalEpisodes: number | null };
  status: WatchStatus;
  progress: number;
  totalEpisodes: number | null;
  score: number | null;
  lastWatchedAt: Date | null;
};

export const getContinueWatching = cache(async (userId: string, limit = 12): Promise<ContinueItem[]> => {
  const rows = await prisma.seasonEntry.findMany({
    where: { entry: { userId }, status: "WATCHING" },
    orderBy: [{ lastWatchedAt: "desc" }, { updatedAt: "desc" }],
    take: limit,
    select: {
      id: true,
      progress: true,
      totalEpisodes: true,
      status: true,
      score: true,
      lastWatchedAt: true,
      season: { select: { id: true, seasonNumber: true, title: true, totalEpisodes: true } },
      entry: {
        select: {
          id: true,
          media: { select: mediaCardSelect },
        },
      },
    },
  });

  return rows.map((row) => ({
    seasonEntryId: row.id,
    entryId: row.entry.id,
    media: row.entry.media,
    season: row.season,
    status: row.status,
    progress: row.progress,
    totalEpisodes: row.totalEpisodes ?? row.season.totalEpisodes,
    score: row.score,
    lastWatchedAt: row.lastWatchedAt,
  }));
});

export type MovieProgressItem = {
  entryId: string;
  media: Prisma.MediaGetPayload<{ select: typeof mediaCardSelect }>;
  watchCount: number;
  status: WatchStatus;
  updatedAt: Date;
};

export const getWatchingMovies = cache(async (userId: string, limit = 12): Promise<MovieProgressItem[]> => {
  const rows = await prisma.mediaEntry.findMany({
    where: { userId, status: "WATCHING", media: { kind: "MOVIE" } },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      watchCount: true,
      status: true,
      updatedAt: true,
      media: { select: mediaCardSelect },
    },
  });
  return rows.map((r) => ({
    entryId: r.id,
    media: r.media,
    watchCount: r.watchCount,
    status: r.status,
    updatedAt: r.updatedAt,
  }));
});

export const getRecentlyFinished = cache(async (userId: string, limit = 10) => {
  const works = await prisma.mediaEntry.findMany({
    where: { userId, status: "COMPLETED", finishedAt: { not: null } },
    orderBy: { finishedAt: "desc" },
    take: limit,
    select: {
      id: true,
      status: true,
      score: true,
      finishedAt: true,
      media: { select: mediaCardSelect },
    },
  });
  const seasons = await prisma.seasonEntry.findMany({
    where: { status: "COMPLETED", finishedAt: { not: null }, entry: { userId } },
    orderBy: { finishedAt: "desc" },
    take: limit,
    select: { ...seasonEntrySelect, entry: { select: { id: true, media: { select: mediaCardSelect } } } },
  });

  return {
    works: works.map((w) => ({ entryId: w.id, media: w.media, score: w.score, finishedAt: w.finishedAt! })),
    seasons: seasons.map((s) => ({
      seasonEntryId: s.id,
      entryId: s.entry.id,
      media: s.entry.media,
      season: s.season,
      progress: s.progress,
      score: s.score,
      finishedAt: s.finishedAt!,
    })),
  };
});

export const getDashboardSummary = cache(async (userId: string) => {
  const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const [byStatus, completedWorks, completedSeasons, totalEntries] = await Promise.all([
    prisma.mediaEntry.groupBy({ by: ["status"], where: { userId }, _count: true }),
    prisma.mediaEntry.count({
      where: { userId, status: "COMPLETED", finishedAt: { gte: yearStart } },
    }),
    prisma.seasonEntry.count({
      where: { status: "COMPLETED", finishedAt: { gte: yearStart }, entry: { userId } },
    }),
    prisma.mediaEntry.count({ where: { userId } }),
  ]);

  const counts = Object.fromEntries(byStatus.map((b) => [b.status, b._count])) as Partial<
    Record<WatchStatus, number>
  >;

  return {
    counts,
    completedThisYear: completedWorks + completedSeasons,
    totalEntries,
  };
});

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

export type LibraryFilters = {
  status?: WatchStatus | "ALL";
  kind?: WorkKind | "ALL";
  tagId?: string;
  genreId?: string;
  source?: "TMDB" | "ANILIST" | "MANUAL" | "ALL";
  sort?: "updated" | "added" | "title" | "score" | "year";
  view?: "work" | "season";
  page?: number;
  perPage?: number;
};

function buildLibraryWhere(userId: string, filters: LibraryFilters): Prisma.MediaEntryWhereInput {
  const where: Prisma.MediaEntryWhereInput = { userId };
  const media: Prisma.MediaWhereInput = {};

  if (filters.kind && filters.kind !== "ALL") media.kind = filters.kind;
  if (filters.source && filters.source !== "ALL") media.source = filters.source;
  if (filters.genreId) media.genres = { some: { genreId: filters.genreId } };
  if (Object.keys(media).length > 0) where.media = media;

  if (filters.tagId) where.tags = { some: { tagId: filters.tagId } };

  // In the season view the status filter applies to individual seasons instead.
  if (filters.view === "season") {
    if (filters.status && filters.status !== "ALL") {
      where.seasons = { some: { status: filters.status } };
    }
  } else if (filters.status && filters.status !== "ALL") {
    where.status = filters.status;
  }

  return where;
}

function buildLibraryOrderBy(sort: LibraryFilters["sort"]): Prisma.MediaEntryOrderByWithRelationInput[] {
  switch (sort) {
    case "added":
      return [{ createdAt: "desc" }];
    case "title":
      return [{ media: { titleOriginal: "asc" } }];
    case "score":
      return [{ score: "desc" }, { updatedAt: "desc" }];
    case "year":
      return [{ media: { releaseDate: "desc" } }];
    case "updated":
    default:
      return [{ updatedAt: "desc" }];
  }
}

export const getLibrary = cache(async (userId: string, filters: LibraryFilters) => {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(60, Math.max(6, filters.perPage ?? 24));
  const where = buildLibraryWhere(userId, filters);
  const orderBy = buildLibraryOrderBy(filters.sort);

  const [total, rows] = await Promise.all([
    prisma.mediaEntry.count({ where }),
    prisma.mediaEntry.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        status: true,
        score: true,
        isFavorite: true,
        notes: true,
        watchCount: true,
        progress: true,
        totalEpisodes: true,
        updatedAt: true,
        media: {
          select: {
            ...mediaCardSelect,
            genres: { select: { genre: { select: { id: true, name: true } } } },
          },
        },
        tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
        seasons: { select: seasonEntrySelect, orderBy: { season: { seasonNumber: "asc" } } },
      },
    }),
  ]);

  return { rows, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
});

/** Flat list of individual season entries, used by the "按季展开" view. */
export const getSeasonLibrary = cache(async (userId: string, filters: LibraryFilters) => {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(60, Math.max(6, filters.perPage ?? 24));

  const where: Prisma.SeasonEntryWhereInput = { entry: { userId } };
  if (filters.status && filters.status !== "ALL") where.status = filters.status;

  const entryFilter: Prisma.MediaEntryWhereInput = { userId };
  const entryMedia: Prisma.MediaWhereInput = {};
  if (filters.kind && filters.kind !== "ALL") entryMedia.kind = filters.kind;
  if (filters.genreId) entryMedia.genres = { some: { genreId: filters.genreId } };
  if (Object.keys(entryMedia).length > 0) entryFilter.media = entryMedia;
  if (filters.tagId) entryFilter.tags = { some: { tagId: filters.tagId } };
  if (Object.keys(entryFilter).length > 1) where.entry = entryFilter;

  const orderBy: Prisma.SeasonEntryOrderByWithRelationInput[] =
    filters.sort === "title"
      ? [{ entry: { media: { titleOriginal: "asc" } } }]
      : filters.sort === "score"
        ? [{ score: "desc" }, { updatedAt: "desc" }]
        : filters.sort === "added"
          ? [{ createdAt: "desc" }]
          : [{ updatedAt: "desc" }];

  const [total, rows] = await Promise.all([
    prisma.seasonEntry.count({ where }),
    prisma.seasonEntry.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        ...seasonEntrySelect,
        entry: {
          select: {
            id: true,
            status: true,
            media: {
              select: {
                ...mediaCardSelect,
                genres: { select: { genre: { select: { id: true, name: true } } } },
              },
            },
          },
        },
      },
    }),
  ]);

  return { rows, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
});

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export const getMediaDetail = cache(async (mediaId: string, userId: string) => {
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    include: {
      genres: { select: { genre: { select: { id: true, name: true } } } },
      seasons: {
        orderBy: { seasonNumber: "asc" },
        include: {
          entries: {
            where: { entry: { userId } },
            select: seasonEntrySelect,
          },
        },
      },
    },
  });
  if (!media) return null;

  const entry = await prisma.mediaEntry.findUnique({
    where: { userId_mediaId: { userId, mediaId } },
    select: {
      id: true,
      status: true,
      score: true,
      isFavorite: true,
      notes: true,
      watchCount: true,
      progress: true,
      totalEpisodes: true,
      startedAt: true,
      finishedAt: true,
      tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
    },
  });

  return { media, entry };
});

export const getUserTags = cache(async (userId: string) =>
  prisma.tag.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true, _count: { select: { entries: true } } },
  }),
);

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export const getStatsOverview = cache(async (userId: string) => {
  const [
    entryStatusRows,
    seasonStatusRows,
    genres,
    completedWorks,
    allCompletedSeasons,
    scoredWorks,
    scoredSeasons,
    movieWatches,
    seasonWatches,
  ] = await Promise.all([
      prisma.mediaEntry.groupBy({ by: ["status"], where: { userId }, _count: true }),
      prisma.seasonEntry.groupBy({
        by: ["status"],
        where: { entry: { userId } },
        _count: true,
      }),
      prisma.genre.findMany({
        where: {
          media: {
            some: {
              media: {
                entries: {
                  some: {
                    userId,
                    OR: [
                      { status: "COMPLETED" },
                      { seasons: { some: { status: "COMPLETED" } } },
                    ],
                  },
                },
              },
            },
          },
        },
        select: { id: true, name: true, _count: { select: { media: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.mediaEntry.findMany({
        where: { userId, status: "COMPLETED" },
        select: { finishedAt: true, score: true, watchCount: true, media: { select: { runtimeMin: true, kind: true } } },
      }),
      prisma.seasonEntry.findMany({
        where: { status: "COMPLETED", entry: { userId } },
        select: { finishedAt: true, score: true, progress: true, entry: { select: { media: { select: { runtimeMin: true } } } } },
      }),
      prisma.mediaEntry.findMany({ where: { userId, score: { not: null } }, select: { score: true } }),
      prisma.seasonEntry.findMany({
        where: { entry: { userId }, score: { not: null } },
        select: { score: true },
      }),
      // Watch time counts everything already watched, regardless of the current
      // status: a movie rewatched twice or a season abandoned at episode 8 both
      // contributed time.
      prisma.mediaEntry.findMany({
        where: { userId, watchCount: { gt: 0 } },
        select: { watchCount: true, media: { select: { runtimeMin: true } } },
      }),
      prisma.seasonEntry.findMany({
        where: { entry: { userId }, progress: { gt: 0 } },
        select: { progress: true, entry: { select: { media: { select: { runtimeMin: true } } } } },
      }),
    ]);

  const workCounts = Object.fromEntries(entryStatusRows.map((r) => [r.status, r._count])) as Partial<
    Record<WatchStatus, number>
  >;
  const seasonCounts = Object.fromEntries(seasonStatusRows.map((r) => [r.status, r._count])) as Partial<
    Record<WatchStatus, number>
  >;

  // Completion buckets only count entries actually marked COMPLETED.
  const completionByYear = new Map<number, number>();
  for (const row of completedWorks) {
    if (row.finishedAt) {
      const y = row.finishedAt.getUTCFullYear();
      completionByYear.set(y, (completionByYear.get(y) ?? 0) + 1);
    }
  }
  for (const row of allCompletedSeasons) {
    if (row.finishedAt) {
      const y = row.finishedAt.getUTCFullYear();
      completionByYear.set(y, (completionByYear.get(y) ?? 0) + 1);
    }
  }

  let totalMinutes = 0;
  for (const row of movieWatches) {
    totalMinutes += (row.media.runtimeMin ?? 0) * row.watchCount;
  }
  for (const row of seasonWatches) {
    totalMinutes += (row.entry.media.runtimeMin ?? 0) * row.progress;
  }

  const scoreBuckets = new Map<number, number>();
  for (const row of [...scoredWorks, ...scoredSeasons]) {
    if (row.score == null) continue;
    scoreBuckets.set(row.score, (scoreBuckets.get(row.score) ?? 0) + 1);
  }

  const years = [...completionByYear.keys()].sort((a, b) => a - b);

  return {
    workCounts,
    seasonCounts,
    genres: genres
      .map((g) => ({ name: g.name, count: g._count.media }))
      .sort((a, b) => b.count - a.count),
    completionsByYear: years.map((year) => ({ year, count: completionByYear.get(year) ?? 0 })),
    scoreDistribution: [...scoreBuckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([score, count]) => ({ score, count })),
    totalMinutes,
    totalCompletedWorks: completedWorks.length,
    totalCompletedSeasons: allCompletedSeasons.length,
  };
});

export const getStatsTopRated = cache(async (userId: string, limit = 10) => {
  const rows = await prisma.mediaEntry.findMany({
    where: { userId, score: { not: null } },
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
    take: limit,
    select: {
      id: true,
      score: true,
      media: { select: mediaCardSelect },
    },
  });
  return rows;
});
