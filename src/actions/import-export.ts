"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { normalizeImport, parseCsv, type ImportPayload } from "@/lib/csv";
import { fail, okWith, type ActionResult } from "@/lib/action-result";
import { upsertMedia } from "@/lib/media-sync";
import type { ExportEntry } from "@/lib/export-data";

export type ImportPreview = {
  entries: number;
  seasons: number;
  movies: number;
  warnings: string[];
  sample: { title: string; source: string; kind: string; seasons: number }[];
};

export type ImportResult = {
  works: number;
  seasons: number;
  skipped: number;
};

async function parsePayload(formData: FormData): Promise<ImportPayload | { error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "请选择一个文件" };
  if (file.size > 8 * 1024 * 1024) return { error: "文件过大（上限 8 MB）" };

  const format = String(formData.get("format") ?? "json");
  const text = await file.text();

  try {
    if (format === "csv") return normalizeImport(parseCsv(text), "csv");
    return normalizeImport(JSON.parse(text), "json");
  } catch {
    return { error: "文件解析失败，请确认格式与内容是否正确" };
  }
}

/** Dry run: report what would be imported without touching the database. */
export async function previewImport(formData: FormData): Promise<ActionResult<ImportPreview>> {
  await requireUser();
  const payload = await parsePayload(formData);
  if ("error" in payload) return fail(payload.error);

  const { entries, warnings } = payload;
  return okWith({
    entries: entries.length,
    seasons: entries.reduce((sum, e) => sum + e.seasons.length, 0),
    movies: entries.filter((e) => e.media.kind === "MOVIE").length,
    warnings,
    sample: entries.slice(0, 8).map((e) => ({
      title: e.media.titleZh || e.media.titleOriginal,
      source: e.media.source,
      kind: e.media.kind,
      seasons: e.seasons.length,
    })),
  });
}

/** Merge imported entries into the current user's library. */
export async function runImport(
  formData: FormData,
  strategy: "merge" | "replace" = "merge",
): Promise<ActionResult<ImportResult>> {
  const user = await requireUser();
  const payload = await parsePayload(formData);
  if ("error" in payload) return fail(payload.error);

  const { entries } = payload;
  let works = 0;
  let seasons = 0;
  let skipped = 0;

  for (const entry of entries) {
    try {
      await upsertEntry(user.id, entry, strategy);
      works += 1;
      seasons += entry.seasons.filter((s) => s.status != null).length;
    } catch {
      skipped += 1;
    }
  }

  return okWith({ works, seasons, skipped });
}

async function upsertEntry(
  userId: string,
  entry: ExportEntry,
  strategy: "merge" | "replace",
) {
  const media = await upsertMedia({
    kind: entry.media.kind,
    source: entry.media.source,
    externalKey: entry.media.externalKey,
    titleZh: entry.media.titleZh,
    titleOriginal: entry.media.titleOriginal,
    titleEn: entry.media.titleEn,
    overview: entry.media.overview,
    posterUrl: entry.media.posterUrl,
    backdropUrl: null,
    releaseDate: entry.media.releaseDate,
    runtimeMin: entry.media.runtimeMin,
    releaseStatus: null,
    totalSeasons: entry.seasons.length || null,
    siteUrl: entry.media.siteUrl ?? "",
    genres: entry.media.genres.map((name) => ({
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || name,
      name,
    })),
    seasons: entry.seasons.map((s) => ({
      seasonNumber: s.seasonNumber,
      title: s.title,
      posterUrl: null,
      totalEpisodes: s.totalEpisodes,
      airedDate: s.airedDate,
      externalKey: `${entry.media.source}:${entry.media.externalKey}:s${s.seasonNumber}`,
    })),
  });

  await prisma.mediaEntry.upsert({
    where: { userId_mediaId: { userId, mediaId: media.id } },
    create: {
      userId,
      mediaId: media.id,
      status: entry.status,
      score: entry.score,
      isFavorite: entry.isFavorite,
      notes: entry.notes,
      watchCount: entry.watchCount,
      startedAt: entry.startedAt ? new Date(entry.startedAt) : null,
      finishedAt: entry.finishedAt ? new Date(entry.finishedAt) : null,
    },
    update:
      strategy === "replace"
        ? {
            status: entry.status,
            score: entry.score,
            isFavorite: entry.isFavorite,
            notes: entry.notes,
            watchCount: entry.watchCount,
            startedAt: entry.startedAt ? new Date(entry.startedAt) : null,
            finishedAt: entry.finishedAt ? new Date(entry.finishedAt) : null,
          }
        : {},
  });

  const record = await prisma.mediaEntry.findUniqueOrThrow({
    where: { userId_mediaId: { userId, mediaId: media.id } },
    select: { id: true },
  });

  for (const name of entry.tags) {
    const tag = await prisma.tag.upsert({
      where: { userId_name: { userId, name } },
      create: { userId, name },
      update: {},
    });
    await prisma.entryTag.upsert({
      where: { entryId_tagId: { entryId: record.id, tagId: tag.id } },
      create: { entryId: record.id, tagId: tag.id },
      update: {},
    });
  }

  const seasons = await prisma.season.findMany({ where: { mediaId: media.id } });
  const byNumber = new Map(seasons.map((s) => [s.seasonNumber, s]));

  for (const season of entry.seasons) {
    if (season.status == null) continue;
    const target = byNumber.get(season.seasonNumber);
    if (!target) continue;

    const data = {
      status: season.status,
      progress: season.progress ?? 0,
      totalEpisodes: season.totalEpisodes,
      score: season.score,
      notes: season.notes,
      startedAt: season.startedAt ? new Date(season.startedAt) : null,
      finishedAt: season.finishedAt ? new Date(season.finishedAt) : null,
      lastWatchedAt: season.lastWatchedAt ? new Date(season.lastWatchedAt) : null,
    };

    await prisma.seasonEntry.upsert({
      where: { entryId_seasonId: { entryId: record.id, seasonId: target.id } },
      create: { entryId: record.id, seasonId: target.id, ...data },
      update: strategy === "replace" ? data : {},
    });
  }
}

const anilistImportSchema = z.object({
  userName: z.string().trim().min(1, "请输入 AniList 用户名").max(40),
  includeScores: z.boolean().optional(),
});

export type AnilistImportResult = { works: number; seasons: number };

/** Import an existing AniList list as tracked series. */
export async function importFromAnilist(
  input: z.input<typeof anilistImportSchema>,
): Promise<ActionResult<AnilistImportResult>> {
  const user = await requireUser();
  const parsed = anilistImportSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "参数不合法");

  try {
    const { getAnilistUserList, fetchAnilistMediaMap, anilistMediaToNormalized } = await import(
      "@/lib/anilist"
    );
    const list = await getAnilistUserList(parsed.data.userName);
    if (list.length === 0) return fail("该 AniList 用户的番剧列表为空");

    const mediaMap = await fetchAnilistMediaMap([...new Set(list.map((e) => e.mediaId))]);

    let works = 0;
    let seasons = 0;

    for (const item of list) {
      const media = mediaMap.get(item.mediaId);
      if (!media) continue;

      // Each AniList entry becomes its own work here, so imported progress stays
      // at the season level (season 1) rather than being merged across seasons.
      const normalized = anilistMediaToNormalized(media);
      const saved = await upsertMedia(normalized);

      const record = await prisma.mediaEntry.upsert({
        where: { userId_mediaId: { userId: user.id, mediaId: saved.id } },
        create: { userId: user.id, mediaId: saved.id, status: item.status },
        update: { status: item.status },
      });

      const season = await prisma.season.findFirst({
        where: { mediaId: saved.id },
        select: { id: true, totalEpisodes: true },
      });
      if (!season) continue;

      await prisma.seasonEntry.upsert({
        where: { entryId_seasonId: { entryId: record.id, seasonId: season.id } },
        create: {
          entryId: record.id,
          seasonId: season.id,
          status: item.status,
          progress: item.progress,
          score: parsed.data.includeScores ? item.score : null,
        },
        update: {
          status: item.status,
          progress: item.progress,
          ...(parsed.data.includeScores ? { score: item.score } : {}),
        },
      });

      works += 1;
      seasons += 1;
    }

    return okWith({ works, seasons });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "AniList 导入失败");
  }
}
