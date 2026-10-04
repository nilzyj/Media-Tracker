"use server";

import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/dal";
import type { MediaSource, WatchStatus, WorkKind } from "@/generated/prisma/client";

export type ExportSeason = {
  seasonNumber: number;
  title: string | null;
  totalEpisodes: number | null;
  airedDate: string | null;
  status: WatchStatus | null;
  progress: number | null;
  score: number | null;
  notes: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  lastWatchedAt: string | null;
};

export type ExportEntry = {
  media: {
    source: MediaSource;
    externalKey: string;
    kind: WorkKind;
    titleOriginal: string;
    titleZh: string | null;
    titleEn: string | null;
    author: string | null;
    overview: string | null;
    posterUrl: string | null;
    releaseDate: string | null;
    runtimeMin: number | null;
    siteUrl: string | null;
    genres: string[];
  };
  status: WatchStatus;
  score: number | null;
  isFavorite: boolean;
  notes: string | null;
  watchCount: number;
  progress: number;
  totalEpisodes: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  tags: string[];
  seasons: ExportSeason[];
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export async function buildExport(userId: string) {
  const entries = await prisma.mediaEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      media: { include: { genres: { include: { genre: true } } } },
      tags: { include: { tag: true } },
      seasons: { include: { season: true } },
    },
  });

  return entries.map(
    (entry): ExportEntry => ({
      media: {
        source: entry.media.source,
        externalKey: entry.media.externalKey,
        kind: entry.media.kind,
        titleOriginal: entry.media.titleOriginal,
        titleZh: entry.media.titleZh,
        titleEn: entry.media.titleEn,
        author: entry.media.author,
        overview: entry.media.overview,
        posterUrl: entry.media.posterUrl,
        releaseDate: iso(entry.media.releaseDate),
        runtimeMin: entry.media.runtimeMin,
        siteUrl: entry.media.siteUrl,
        genres: entry.media.genres.map((g) => g.genre.name),
      },
      status: entry.status,
      score: entry.score,
      isFavorite: entry.isFavorite,
      notes: entry.notes,
      watchCount: entry.watchCount,
      progress: entry.progress,
      totalEpisodes: entry.totalEpisodes,
      startedAt: iso(entry.startedAt),
      finishedAt: iso(entry.finishedAt),
      tags: entry.tags.map((t) => t.tag.name),
      seasons: entry.seasons
        .map(
          (se): ExportSeason => ({
            seasonNumber: se.season.seasonNumber,
            title: se.season.title,
            totalEpisodes: se.totalEpisodes ?? se.season.totalEpisodes,
            airedDate: iso(se.season.airedDate),
            status: se.status,
            progress: se.progress,
            score: se.score,
            notes: se.notes,
            startedAt: iso(se.startedAt),
            finishedAt: iso(se.finishedAt),
            lastWatchedAt: iso(se.lastWatchedAt),
          }),
        )
        .sort((a, b) => a.seasonNumber - b.seasonNumber),
    }),
  );
}

export async function requireExportUser(): Promise<string | null> {
  return getUserId();
}
