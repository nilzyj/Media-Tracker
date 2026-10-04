"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { fail, ok, okWith, errorMessage, type ActionResult } from "@/lib/action-result";
import { STATUS_ORDER, isWatchStatus } from "@/lib/constants";
import type { WatchStatus } from "@/generated/prisma/client";

function refresh() {
  revalidatePath("/", "layout");
}

const scoreSchema = z.number().int().min(1).max(10).nullable();

async function ownedEntry(entryId: string, userId: string) {
  return prisma.mediaEntry.findFirst({
    where: { id: entryId, userId },
    select: {
      id: true,
      status: true,
      mediaId: true,
      progress: true,
      totalEpisodes: true,
      media: { select: { kind: true } },
    },
  });
}

async function ownedSeasonEntry(seasonEntryId: string, userId: string) {
  return prisma.seasonEntry.findFirst({
    where: { id: seasonEntryId, entry: { userId } },
    select: {
      id: true,
      status: true,
      progress: true,
      totalEpisodes: true,
      entryId: true,
      season: { select: { id: true, mediaId: true, totalEpisodes: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Work-level entry
// ---------------------------------------------------------------------------

const updateEntrySchema = z.object({
  entryId: z.string().min(1),
  status: z.string().optional(),
  score: z.number().int().min(0).max(10).nullable().optional(),
  isFavorite: z.boolean().optional(),
  notes: z.string().max(5000).optional(),
});

export async function updateEntry(input: z.input<typeof updateEntrySchema>): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = updateEntrySchema.safeParse(input);
  if (!parsed.success) return fail("参数不合法");

  const { entryId } = parsed.data;
  const existing = await ownedEntry(entryId, user.id);
  if (!existing) return fail("未找到该记录");

  const data: Record<string, unknown> = {};

  if (parsed.data.status !== undefined) {
    if (!isWatchStatus(parsed.data.status)) return fail("状态值不合法");
    data.status = parsed.data.status;
    // Keep completion timestamps consistent with a manually chosen status.
    if (parsed.data.status === "COMPLETED") data.finishedAt = new Date();
    else data.finishedAt = null;
    if (parsed.data.status === "WATCHING" && existing.status === "PLANNING") {
      data.startedAt = new Date();
    }
  }

  if (parsed.data.score !== undefined) {
    data.score = parsed.data.score === 0 ? null : scoreSchema.parse(parsed.data.score);
  }
  if (parsed.data.isFavorite !== undefined) data.isFavorite = parsed.data.isFavorite;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes || null;

  try {
    await prisma.mediaEntry.update({ where: { id: entryId }, data });
    refresh();
    return ok();
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function setEntryTags(entryId: string, tagNames: string[]): Promise<ActionResult> {
  const user = await requireUser();
  const existing = await ownedEntry(entryId, user.id);
  if (!existing) return fail("未找到该记录");

  const names = [...new Set(tagNames.map((t) => t.trim()).filter(Boolean))].slice(0, 30);

  try {
    for (const name of names) {
      await prisma.tag.upsert({
        where: { userId_name: { userId: user.id, name } },
        create: { userId: user.id, name },
        update: {},
      });
    }
    const tags = await prisma.tag.findMany({ where: { userId: user.id, name: { in: names } } });
    await prisma.entryTag.deleteMany({ where: { entryId } });
    if (tags.length > 0) {
      await prisma.entryTag.createMany({
        data: tags.map((t) => ({ entryId, tagId: t.id })),
        skipDuplicates: true,
      });
    }
    refresh();
    return ok();
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function deleteEntry(entryId: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await prisma.mediaEntry.deleteMany({ where: { id: entryId, userId: user.id } });
    refresh();
    return ok();
  } catch (error) {
    return fail(errorMessage(error));
  }
}

/**
 * Explicitly copy an aggregate status onto the work-level entry. The overall
 * status is maintained by hand, so this is offered as a convenience action
 * rather than running automatically whenever a season changes.
 */
export async function syncEntryStatusFromSeasons(
  entryId: string,
): Promise<ActionResult<{ status: WatchStatus }>> {
  const user = await requireUser();
  const entry = await ownedEntry(entryId, user.id);
  if (!entry) return fail("未找到该记录");

  const seasons = await prisma.seasonEntry.findMany({
    where: { entryId },
    select: { status: true },
  });
  if (seasons.length === 0) return fail("还没有追踪任何季");

  const aggregate = seasons.reduce<WatchStatus>(
    (acc, cur) => (STATUS_ORDER[cur.status] < STATUS_ORDER[acc] ? cur.status : acc),
    "DROPPED",
  );

  await prisma.mediaEntry.update({
    where: { id: entryId },
    data: {
      status: aggregate,
      finishedAt: aggregate === "COMPLETED" ? new Date() : null,
    },
  });

  refresh();
  return okWith({ status: aggregate });
}

// ---------------------------------------------------------------------------
// Season-level entry
// ---------------------------------------------------------------------------

export async function joinSeason(entryId: string, seasonId: string): Promise<ActionResult> {
  const user = await requireUser();
  const entry = await ownedEntry(entryId, user.id);
  if (!entry) return fail("未找到该记录");

  const season = await prisma.season.findFirst({ where: { id: seasonId, mediaId: entry.mediaId } });
  if (!season) return fail("未找到该季");

  try {
    await prisma.seasonEntry.upsert({
      where: { entryId_seasonId: { entryId, seasonId } },
      create: { entryId, seasonId, status: "PLANNING", progress: 0 },
      update: {},
    });
    refresh();
    return ok();
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function leaveSeason(seasonEntryId: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await prisma.seasonEntry.deleteMany({ where: { id: seasonEntryId, entry: { userId: user.id } } });
    refresh();
    return ok();
  } catch (error) {
    return fail(errorMessage(error));
  }
}

const updateSeasonSchema = z.object({
  seasonEntryId: z.string().min(1),
  status: z.string().optional(),
  score: z.number().int().min(0).max(10).nullable().optional(),
  notes: z.string().max(5000).optional(),
  totalEpisodes: z.number().int().min(0).max(5000).nullable().optional(),
});

export async function updateSeasonEntry(
  input: z.input<typeof updateSeasonSchema>,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = updateSeasonSchema.safeParse(input);
  if (!parsed.success) return fail("参数不合法");

  const existing = await ownedSeasonEntry(parsed.data.seasonEntryId, user.id);
  if (!existing) return fail("未找到该季记录");

  const data: Record<string, unknown> = {};

  if (parsed.data.status !== undefined) {
    if (!isWatchStatus(parsed.data.status)) return fail("状态值不合法");
    data.status = parsed.data.status;
    if (parsed.data.status === "COMPLETED") {
      const total = existing.totalEpisodes ?? existing.season.totalEpisodes;
      data.finishedAt = new Date();
      if (total && existing.progress < total) data.progress = total;
    } else {
      data.finishedAt = null;
    }
    if (parsed.data.status === "WATCHING") {
      data.startedAt = new Date();
      data.lastWatchedAt = new Date();
    }
  }

  if (parsed.data.score !== undefined) {
    data.score = parsed.data.score === 0 ? null : scoreSchema.parse(parsed.data.score);
  }
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes || null;
  if (parsed.data.totalEpisodes !== undefined) {
    const total = parsed.data.totalEpisodes === 0 ? null : parsed.data.totalEpisodes;
    data.totalEpisodes = total;
    const bound = total ?? existing.season.totalEpisodes;
    if (bound && existing.progress > bound) data.progress = bound;
  }

  try {
    await prisma.seasonEntry.update({ where: { id: parsed.data.seasonEntryId }, data });
    refresh();
    return ok();
  } catch (error) {
    return fail(errorMessage(error));
  }
}

/** Increment or decrement how many episodes of a season have been watched. */
export async function bumpSeasonProgress(
  seasonEntryId: string,
  delta: number,
): Promise<ActionResult<{ progress: number; total: number | null; reachedEnd: boolean }>> {
  const user = await requireUser();
  const existing = await ownedSeasonEntry(seasonEntryId, user.id);
  if (!existing) return fail("未找到该季记录");

  const total = existing.totalEpisodes ?? existing.season.totalEpisodes;
  const next = Math.max(0, Math.min(total ?? Number.MAX_SAFE_INTEGER, existing.progress + delta));
  const reachedEnd = Boolean(total && next >= total);

  const data: Record<string, unknown> = { progress: next, lastWatchedAt: new Date() };
  if (next > 0 && existing.status === "PLANNING") {
    data.status = "WATCHING";
    data.startedAt = new Date();
  }
  if (reachedEnd && existing.status === "WATCHING") {
    data.status = "COMPLETED";
    data.finishedAt = new Date();
  }

  try {
    await prisma.seasonEntry.update({ where: { id: seasonEntryId }, data });
    refresh();
    return okWith({ progress: next, total, reachedEnd });
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function setSeasonProgress(
  seasonEntryId: string,
  progress: number,
): Promise<ActionResult> {
  const user = await requireUser();
  const existing = await ownedSeasonEntry(seasonEntryId, user.id);
  if (!existing) return fail("未找到该季记录");

  const total = existing.totalEpisodes ?? existing.season.totalEpisodes;
  const next = Math.max(0, Math.min(total ?? Number.MAX_SAFE_INTEGER, Math.floor(progress)));

  const data: Record<string, unknown> = { progress: next, lastWatchedAt: new Date() };
  if (total && next >= total && existing.status !== "DROPPED" && existing.status !== "ON_HOLD") {
    data.status = "COMPLETED";
    data.finishedAt = new Date();
  }

  try {
    await prisma.seasonEntry.update({ where: { id: seasonEntryId }, data });
    refresh();
    return ok();
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function markAllSeasonsWatched(entryId: string): Promise<ActionResult> {
  const user = await requireUser();
  const entry = await ownedEntry(entryId, user.id);
  if (!entry) return fail("未找到该记录");

  const seasons = await prisma.season.findMany({
    where: { mediaId: entry.mediaId },
    select: { id: true, totalEpisodes: true },
  });
  if (seasons.length === 0) return fail("该作品没有季信息");

  const now = new Date();
  for (const season of seasons) {
    await prisma.seasonEntry.upsert({
      where: { entryId_seasonId: { entryId, seasonId: season.id } },
      create: {
        entryId,
        seasonId: season.id,
        status: "COMPLETED",
        progress: season.totalEpisodes ?? 0,
        finishedAt: now,
        lastWatchedAt: now,
      },
      update: {
        status: "COMPLETED",
        progress: season.totalEpisodes ?? 0,
        finishedAt: now,
      },
    });
  }

  refresh();
  return ok();
}

// ---------------------------------------------------------------------------
// Work-level progress (books, manga, podcasts, single-season shows)
// ---------------------------------------------------------------------------

export async function bumpEntryProgress(
  entryId: string,
  delta: number,
): Promise<ActionResult<{ progress: number; total: number | null; reachedEnd: boolean }>> {
  const user = await requireUser();
  const existing = await ownedEntry(entryId, user.id);
  if (!existing) return fail("未找到该记录");

  const total = existing.totalEpisodes;
  const next = Math.max(0, Math.min(total ?? Number.MAX_SAFE_INTEGER, existing.progress + delta));
  const reachedEnd = Boolean(total && next >= total);

  const data: Record<string, unknown> = { progress: next };
  if (next > 0 && existing.status === "PLANNING") {
    data.status = "WATCHING";
    data.startedAt = new Date();
  }
  if (reachedEnd && existing.status === "WATCHING") {
    data.status = "COMPLETED";
    data.finishedAt = new Date();
  }

  try {
    await prisma.mediaEntry.update({ where: { id: entryId }, data });
    refresh();
    return okWith({ progress: next, total, reachedEnd });
  } catch (error) {
    return fail(errorMessage(error));
  }
}

/** Set the work-level total, needed before progress can be tracked. */
export async function setEntryTotalEpisodes(
  entryId: string,
  total: number,
): Promise<ActionResult> {
  const user = await requireUser();
  const existing = await ownedEntry(entryId, user.id);
  if (!existing) return fail("未找到该记录");

  const clean = Math.max(0, Math.min(100000, Math.floor(total) || 0));
  try {
    await prisma.mediaEntry.update({
      where: { id: entryId },
      data: { totalEpisodes: clean || null, progress: Math.min(existing.progress, clean || 0) },
    });
    refresh();
    return ok();
  } catch (error) {
    return fail(errorMessage(error));
  }
}

// ---------------------------------------------------------------------------
// Movie watch count
// ---------------------------------------------------------------------------

export async function bumpWatchCount(
  entryId: string,
  delta: number,
): Promise<ActionResult<{ watchCount: number }>> {
  const user = await requireUser();
  const existing = await ownedEntry(entryId, user.id);
  if (!existing) return fail("未找到该记录");
  if (existing.media.kind !== "MOVIE") return fail("该操作仅适用于电影");

  const current = await prisma.mediaEntry.findUnique({
    where: { id: entryId },
    select: { watchCount: true },
  });
  const next = Math.max(0, (current?.watchCount ?? 0) + delta);

  try {
    await prisma.mediaEntry.update({
      where: { id: entryId },
      data: {
        watchCount: next,
        startedAt: next > 0 ? new Date() : null,
        finishedAt: next > 0 ? new Date() : null,
      },
    });
    refresh();
    return okWith({ watchCount: next });
  } catch (error) {
    return fail(errorMessage(error));
  }
}
