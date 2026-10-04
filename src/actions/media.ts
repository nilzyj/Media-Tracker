"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { upsertMedia } from "@/lib/media-sync";
import { getTmdbMovie, getTmdbTv, isTmdbConfigured, UpstreamError } from "@/lib/tmdb";
import { getAnilistMedia } from "@/lib/anilist";
import { fail, ok, okWith, errorMessage, type ActionResult } from "@/lib/action-result";
import type { NormalizedMedia } from "@/lib/tmdb";
import type { WorkKind } from "@/generated/prisma/client";
import { SEASONAL_KINDS } from "@/lib/constants";

export type MediaPreview = {
  source: "TMDB" | "ANILIST";
  externalKey: string;
  kind: WorkKind;
  title: string;
  seasonCount: number;
  seasons: { seasonNumber: number; title: string | null; totalEpisodes: number | null }[];
};

async function loadNormalized(
  source: "TMDB" | "ANILIST",
  externalKey: string,
  kindHint?: WorkKind,
): Promise<NormalizedMedia> {
  if (source === "TMDB") {
    if (!isTmdbConfigured()) throw new UpstreamError("未配置 TMDB_API_READ_TOKEN", 401);
    return kindHint === "MOVIE" ? await getTmdbMovie(externalKey) : await getTmdbTv(externalKey);
  }
  return getAnilistMedia(Number(externalKey));
}

/**
 * Inspect an upstream title without touching the database. The search page uses
 * this to show how many seasons were detected before asking for confirmation.
 */
export async function probeMedia(
  source: "TMDB" | "ANILIST",
  externalKey: string,
  kindHint?: WorkKind,
): Promise<ActionResult<MediaPreview>> {
  try {
    const data = await loadNormalized(source, externalKey, kindHint);
    return okWith({
      source,
      externalKey,
      kind: data.kind,
      title: data.titleZh ?? data.titleOriginal,
      seasonCount: data.seasons.length,
      seasons: data.seasons.map((s) => ({
        seasonNumber: s.seasonNumber,
        title: s.title,
        totalEpisodes: s.totalEpisodes,
      })),
    });
  } catch (error) {
    return fail(errorMessage(error));
  }
}

/** Fetch upstream metadata, upsert the catalogue row and create the entry. */
export async function addMediaToLibrary(
  source: "TMDB" | "ANILIST",
  externalKey: string,
  kindHint?: WorkKind,
): Promise<ActionResult<{ mediaId: string; title: string; seasonCount: number }>> {
  const user = await requireUser();

  try {
    const data = await loadNormalized(source, externalKey, kindHint);
    const media = await upsertMedia(data);

    await prisma.mediaEntry.upsert({
      where: { userId_mediaId: { userId: user.id, mediaId: media.id } },
      create: { userId: user.id, mediaId: media.id, status: "PLANNING" },
      update: {},
    });

    revalidatePath("/", "layout");
    return okWith({
      mediaId: media.id,
      title: data.titleZh ?? data.titleOriginal,
      seasonCount: data.seasons.length,
    });
  } catch (error) {
    return fail(errorMessage(error));
  }
}

const manualSchema = z.object({
  title: z.string().trim().min(1, "请填写标题").max(200),
  titleZh: z.string().trim().max(200).optional(),
  author: z.string().trim().max(200).optional(),
  overview: z.string().trim().max(4000).optional(),
  kind: z.enum(["MOVIE", "TV", "ANIME", "BOOK", "MANGA", "PODCAST"]),
  posterUrl: z
    .union([z.url("海报必须是有效链接"), z.literal("")])
    .optional(),
  releaseDate: z.string().optional(),
  runtimeMin: z.coerce.number().int().min(0).max(2000).optional(),
  seasonCount: z.coerce.number().int().min(1).max(100).optional(),
  seasonEpisodes: z.coerce.number().int().min(0).max(5000).optional(),
  totalEpisodes: z.coerce.number().int().min(0).max(100000).optional(),
});

/** Fallback path when no API key is configured or a title is not indexed. */
export async function createManualMedia(
  input: z.input<typeof manualSchema>,
): Promise<ActionResult<{ mediaId: string }>> {
  const user = await requireUser();
  const parsed = manualSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "输入不合法");
  const data = parsed.data;

  try {
    const externalKey = `manual-${crypto.randomUUID()}`;
    const seasonCount = SEASONAL_KINDS.includes(data.kind) ? (data.seasonCount ?? 1) : 0;
    const episodes = data.seasonEpisodes ?? null;

    const media = await upsertMedia({
      kind: data.kind,
      source: "MANUAL",
      externalKey,
      titleZh: data.titleZh?.trim() || null,
      titleOriginal: data.title,
      titleEn: null,
      author: data.author?.trim() || null,
      overview: data.overview?.trim() || null,
      posterUrl: data.posterUrl || null,
      backdropUrl: null,
      releaseDate: data.releaseDate ? new Date(data.releaseDate).toISOString() : null,
      runtimeMin: data.runtimeMin ?? null,
      releaseStatus: "FINISHED",
      totalSeasons: seasonCount || null,
      siteUrl: "",
      genres: [],
      seasons: Array.from({ length: seasonCount }, (_, i) => ({
        seasonNumber: i + 1,
        title: `第 ${i + 1} 季`,
        posterUrl: null,
        totalEpisodes: episodes,
        airedDate: null,
        externalKey: `${externalKey}:s${i + 1}`,
      })),
    });

    await prisma.mediaEntry.create({
      data: {
        userId: user.id,
        mediaId: media.id,
        status: "PLANNING",
        totalEpisodes: data.totalEpisodes ?? null,
      },
    });

    revalidatePath("/", "layout");
    return okWith({ mediaId: media.id });
  } catch (error) {
    return fail(errorMessage(error));
  }
}

/** Re-pull metadata from the upstream source, keeping tracking data intact. */
export async function refreshMediaMetadata(mediaId: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const media = await prisma.media.findFirst({
      where: { id: mediaId, entries: { some: { userId: user.id } } },
      select: { source: true, externalKey: true, kind: true },
    });
    if (!media) return fail("未找到该条目");
    if (media.source === "MANUAL") return fail("手动录入的条目无法自动刷新");

    const data = await loadNormalized(media.source, media.externalKey, media.kind);
    await upsertMedia(data);

    revalidatePath("/", "layout");
    return ok();
  } catch (error) {
    return fail(errorMessage(error));
  }
}

/** Remove the work from this user's library (catalogue row is kept). */
export async function deleteMedia(mediaId: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await prisma.mediaEntry.deleteMany({ where: { mediaId, userId: user.id } });
    revalidatePath("/", "layout");
    return ok();
  } catch (error) {
    return fail(errorMessage(error));
  }
}
