import "server-only";
import { prisma } from "@/lib/db";
import type { Media } from "@/generated/prisma/client";
import type { NormalizedMedia } from "@/lib/tmdb";

export type MediaWithSeasons = Media & { seasons: { id: string; seasonNumber: number }[] };

/**
 * Persist a normalised upstream payload as the shared catalogue row plus its
 * season list. Safe to call repeatedly — re-syncing only refreshes upstream
 * metadata, never the per-user tracking data.
 */
export async function upsertMedia(data: NormalizedMedia): Promise<Media> {
  const media = await prisma.media.upsert({
    where: { source_externalKey: { source: data.source, externalKey: data.externalKey } },
    create: {
      kind: data.kind,
      source: data.source,
      externalKey: data.externalKey,
      titleZh: data.titleZh,
      titleOriginal: data.titleOriginal,
      titleEn: data.titleEn,
      overview: data.overview,
      posterUrl: data.posterUrl,
      backdropUrl: data.backdropUrl,
      releaseDate: data.releaseDate ? new Date(data.releaseDate) : null,
      runtimeMin: data.runtimeMin,
      releaseStatus: data.releaseStatus,
      totalSeasons: data.totalSeasons,
      siteUrl: data.siteUrl,
    },
    update: {
      kind: data.kind,
      titleZh: data.titleZh,
      titleOriginal: data.titleOriginal,
      titleEn: data.titleEn,
      overview: data.overview,
      posterUrl: data.posterUrl,
      backdropUrl: data.backdropUrl,
      releaseDate: data.releaseDate ? new Date(data.releaseDate) : null,
      runtimeMin: data.runtimeMin,
      releaseStatus: data.releaseStatus,
      totalSeasons: data.totalSeasons,
      siteUrl: data.siteUrl,
    },
  });

  if (data.genres.length > 0) {
    await prisma.$transaction(
      data.genres.map((genre) =>
        prisma.genre.upsert({
          where: { slug: genre.slug },
          create: { slug: genre.slug, name: genre.name },
          update: { name: genre.name },
        }),
      ),
    );
    const genreRows = await prisma.genre.findMany({
      where: { slug: { in: data.genres.map((g) => g.slug) } },
      select: { id: true },
    });
    await prisma.mediaGenre.createMany({
      data: genreRows.map((g) => ({ mediaId: media.id, genreId: g.id })),
      skipDuplicates: true,
    });
  }

  if (data.seasons.length > 0) {
    for (const season of data.seasons) {
      await prisma.season.upsert({
        where: { mediaId_seasonNumber: { mediaId: media.id, seasonNumber: season.seasonNumber } },
        create: {
          mediaId: media.id,
          seasonNumber: season.seasonNumber,
          title: season.title ?? `第 ${season.seasonNumber} 季`,
          posterUrl: season.posterUrl,
          totalEpisodes: season.totalEpisodes,
          airedDate: season.airedDate ? new Date(season.airedDate) : null,
          externalKey: season.externalKey,
        },
        update: {
          title: season.title ?? `第 ${season.seasonNumber} 季`,
          posterUrl: season.posterUrl,
          totalEpisodes: season.totalEpisodes,
          airedDate: season.airedDate ? new Date(season.airedDate) : null,
        },
      });
    }
  }

  return media;
}

export async function findMedia(source: "TMDB" | "ANILIST", externalKey: string): Promise<Media | null> {
  return prisma.media.findUnique({
    where: { source_externalKey: { source, externalKey } },
  });
}

export async function resyncMedia(mediaId: string): Promise<Media | null> {
  const existing = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!existing) return null;

  // 书籍 / 漫画 / 播客没有上游数据源，只能是手工录入，保持原样。
  if (existing.source === "MANUAL") return existing;

  if (existing.source === "TMDB") {
    if (existing.kind !== "MOVIE" && existing.kind !== "TV") return existing;
    const { getTmdbMovie, getTmdbTv } = await import("@/lib/tmdb");
    const data = existing.kind === "MOVIE" ? await getTmdbMovie(existing.externalKey) : await getTmdbTv(existing.externalKey);
    return upsertMedia(data);
  }

  if (existing.source === "ANILIST") {
    if (existing.kind !== "ANIME") return existing;
    const { getAnilistMedia } = await import("@/lib/anilist");
    const data = await getAnilistMedia(Number(existing.externalKey));
    return upsertMedia({ ...data, externalKey: existing.externalKey });
  }

  return existing;
}
